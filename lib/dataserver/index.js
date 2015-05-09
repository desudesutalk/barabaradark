var net = require('net');
var crpt = require('crypto');

var events = require('events');
var utils = require('util');
var shttp = require('socks5-client');

var DataStore = require('./datastore.js');
var PeerList = require('./peerlist.js');
var Peer = require('./peer.js');
var pow = require('../pow.js');



var DataServer = function DataServer(dataDir, host, opt) {
	
	this.dataStore = new DataStore(dataDir);
	this.peerList = new PeerList(dataDir, host);

	var self = this;
	var bootstrap = this.peerList.getBootStrap(),
		outs = {};
	var connections = [];

	console.log('Bootstraping to: ', bootstrap);

	this.dataStore.on('fileadded', function(fname){
		console.log('dataStore emit file: ', fname);
		for(p in outs){
			if(outs[p]){
				outs[p].sendMsg(3, new Buffer(JSON.stringify([fname])));
				console.log('send to: ', p);
			}
		}

		for (var i = 0; i < connections.length; i++) {
			connections[i].sendMsg(3, new Buffer(JSON.stringify([fname])));
		}
    }.bind(this));


	function feedFiles(peer, list){
		if(list.length === 0) return false;
		console.log('feeding ' + peer.connectedTo + ' with ', list);		

		var files = list, file = files.pop(), content;		

		var feeder = function feeder(){
			if(files.length === 0) return false;
			
			file = files.pop();

			var unsent = 0;

			if(peer.connectedTo){
				unsent = peer.socket.socket.bufferSize;
			}else{
				unsent = peer.socket.bufferSize;
			}

			if(unsent > 0){
				setTimeout(feeder, 250);
				return false;
			}
			
			content = self.dataStore.getFile(file);
			if(content){
				peer.sendMsg(100, content);
			}
			setTimeout(feeder, 250);
		};

		content = self.dataStore.getFile(file);
		if(content){
			peer.sendMsg(100, content);
		}
		setTimeout(feeder, 250);
		
	};


	function onMsgDataList(list, peer){
		console.log('onMsgDataList: ' + peer.connectedTo);
		var files = self.dataStore.getListDiff(list);
	    if(files.have.length > 0) peer.sendMsg(3, new Buffer(JSON.stringify(files.have)));
		if(files.need.length > 0) peer.sendMsg(4, new Buffer(JSON.stringify(files.need)));
		console.log('this is the file diff', files);
	}


	function onMsgDataOffer(list, peer){
		console.log('onMsgDataOffer: ' + peer.connectedTo);
		var files = self.dataStore.getNeeds(list);
	    console.log('request from offer', files);
		if(files.length > 0) peer.sendMsg(4, new Buffer(JSON.stringify(files)));
	}


	function onMsgDataRequest(list, peer){
		console.log('onMsgDataRequest: ' + peer.connectedTo);
		if(list.length > 0) feedFiles(peer, list);
	}


	function onMsgPeerList(list, peer){
		console.log('onMsgPeerList: ' + peer.connectedTo);
		var pn = self.peerList.getListDiff(list);
    	if(pn) peer.sendMsg(1, new Buffer(JSON.stringify(pn)));
    	self.peerList.addList(list);
	}


	function onMsgMessage(msg, peer){
		console.log('onMsgMessage: ' + peer.connectedTo);
		self.dataStore.addFile(msg);
	}


	this.server = net.createServer(function(c) { //'connection' listener
	    console.log('client connected');
	    var peer = new Peer(c);
	    connections.push(peer);
	    peer.connect(c);

	    peer.on('disconnect', function(p){
	    	connections = connections.filter(function (val){return val !== p;});
	    	console.log('remote peer diconnectd.')
	    });

	    peer.on('datalist', onMsgDataList);	    
	    peer.on('dataoffer', onMsgDataOffer);
	    peer.on('datarequest', onMsgDataRequest);
		peer.on('peerlist', onMsgPeerList);
	    peer.on('message', onMsgMessage);

	     peer.on('error', function(msg, peer){
	     	connections = connections.filter(function (val){return val !== p;});
	    	console.log('remote peer error.')
	    });

	});

	this.server.listen(opt.listenPort, '127.0.0.1', function() { //'listening' listener
	  console.log('server bound');
	});


	function conectTo(host){
		if(host in outs) return false;
		
		console.log('Connecting to: ', host);

		outs[host] = null;
		
		var s = shttp.createConnection ({
			socksHost: '127.0.0.1',
			socksPort : opt.socksPortNumber,
			port: 47654,
			host: host
		});

		//var s = net.createConnection (host);

		s.on('error', function(err){
			console.log('unable to connect ' + host);
		    outs[host] = undefined;
		    delete outs[host];
		    connectNext();
		})
		
		s.on('connect', function() {

			var peer = new Peer();
	    	outs[host] = peer;
	    	peer.connect(s, host);
			
			peer.on('datalist', onMsgDataList);	    
		    peer.on('dataoffer', onMsgDataOffer);
		    peer.on('datarequest', onMsgDataRequest);
			peer.on('peerlist', onMsgPeerList);
		    peer.on('message', onMsgMessage);
 

		    peer.on('disconnect', function(list, peer){
		    	console.log('outbound connection disconnectd');
		    	outs[host] = undefined;
		    	delete outs[host];
		    	connectNext();
		    });

		    peer.on('error', function(msg, peer){
		    	console.log('outbound connection error');
		    	outs[host] = undefined;
		    	delete outs[host];
		    	connectNext();
		    });

			peer.sendMsg(1, new Buffer(JSON.stringify(self.peerList.list)));
			peer.sendMsg(2, new Buffer(JSON.stringify(self.dataStore.getList())));

			self.peerList.peerSeen(host);
		  
		});

	};


	function connectNext(){
		setTimeout(connectNext, 2000);

		if(Object.keys(outs).length >= 8) return false;
		
		var peer = self.peerList.getPeer();
		if(!peer || peer in outs) return false;

		console.log('Try to connect: ', peer);

		conectTo(peer);
	};

	for (var i = 0; i < bootstrap.length; i++) {		
		conectTo(bootstrap[i].host);
	}
	setTimeout(connectNext, 2000);

}

DataServer.prototype.insertFile = function insertFile(data){
	if(data.length > 2*1024*1024 - 64) return false;

	var ts = Math.floor(Date.now() / 1000),
		tsBuf = new Buffer(4);
	
	tsBuf.writeUIntBE(ts, 0, 4);

	var hash = crpt.createHash('sha256').update(tsBuf).update(data).digest();
	pow.calc(hash, data.length, function(hash, nonce){
		console.log(hash,new Buffer(nonce,'base64'), tsBuf, data);
		this.dataStore.addFile(Buffer.concat([new Buffer(5), new Buffer(nonce,'base64'), tsBuf, data]));
	}.bind(this));
};

module.exports = DataServer;
