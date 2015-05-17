"use strict";

var events = require('events');
var utils = require('util');
var crpt = require('crypto');
var pow = require('../pow.js');
var ntp_time = require('../ntp_time.js');

var Peer = function Peer(){
	events.EventEmitter.call(this);
	this.connectedTo = null;
	this.buf = new Buffer(0);
	this.isRecieving = false;
	this.bLength = 0;
	this.socket = null;
};
utils.inherits(Peer, events.EventEmitter);

Peer.prototype.connect = function connect(socket, peer){
	if(peer) this.connectedTo = peer;
	var self = this;
	this.socket = socket;
	this.socket.setKeepAlive(true);

    socket.on('data', function(data) {
    	this.buf = Buffer.concat([this.buf, data]);

        if(!this.isRecieving && this.buf.length >= 4){
        	this.isRecieving = true;
        	this.bLength = this.buf.readUIntLE(0, 4);        	
        }

        if(this.isRecieving && this.buf.length >= this.bLength){
			this.isRecieving = false;
			var tbuf = new Buffer(this.bLength);

			this.buf.copy(tbuf, 0, 0, this.bLength);

			this.onmsg(tbuf);

			this.buf = this.buf.slice(this.bLength);
        }
    }.bind(this));

    socket.on('end', function() {
        this.emit('disconnect', this);
    }.bind(this));

    socket.on('drain', function() {
    	console.log('socket drain');
        this.emit('drain', this);
    }.bind(this));

    socket.on('close', function() {
        this.emit('disconnect', this);
    }.bind(this));

    socket.on('error', function() {
        this.emit('error', this);
    }.bind(this));


};

Peer.prototype.onmsg = function onmsg(msg){
	var plist;

	console.log('Get message type: ', msg[4]);

	if(msg[4] === 0){ // ping
		return true;
	}

	if(msg[4] == 1){ // peer list
		try{
			plist = JSON.parse(msg.slice(5).toString());
		}catch(e){
			console.error('peer list json error');
			return false;
		}
		this.emit('peerlist', plist, this);
	}

	if(msg[4] == 2){ // data list
		try{
			plist = JSON.parse(msg.slice(5).toString());
		}catch(e){
			console.error('data list json error');
			return false;
		}
		this.emit('datalist', plist, this);
	}

	if(msg[4] == 3){ // data offer
		try{
			plist = JSON.parse(msg.slice(5).toString());
		}catch(e){
			console.error('data offer json error');
			return false;
		}
		this.emit('dataoffer', plist, this);
	}

	if(msg[4] == 4){ // data request
		try{
			plist = JSON.parse(msg.slice(5).toString());
		}catch(e){
			console.error('data request json error');
			return false;
		}
		this.emit('datarequest', plist, this);
	}

	if(msg[4] == 100){ // message
		var tsBuf = msg.readUIntBE(11, 4),
		    ts = Math.floor(ntp_time.now() / 1000);

		if(ts - 2*24*60*60 > tsBuf){
			console.log('to old!');
			return false;
		}

		if(ts + 60 < tsBuf){
			console.log('in future!');
			return false;
		}

		var hash = crpt.createHash('sha256').update(msg.slice(11)).digest();
		if(!pow.check(hash, msg.slice(5,11), msg.length - 15)){
			console.log('Bad pow!', hash.toString('base64'));
			return false;	
		}
		
		this.emit('message', msg, this);
	}
};

Peer.prototype.sendMsg = function sendMsg(type, data){
	var buf = new Buffer(data.length + 5);

	buf.writeUIntLE(buf.length, 0, 4);
	buf[4] = type;
	data.copy(buf, 5);

	this.socket.write(buf);
	console.log('Sent message type: ', type);

};

module.exports = Peer;
