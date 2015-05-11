"use strict";

var win = require('nw.gui');
$('.open_dev_tools').on('click', function(){
	win.Window.get().showDevTools();
});

var opt  = require('./lib/options.js');

var thsBuilder = require('ths');
var fs = require('fs'); 
var DataServer = require('./lib/dataserver');
var crpt = require('crypto');
var EC = require('elliptic').ec;
var ec = new EC('secp256k1');
var bs58 = require('bs58');
var DataBase = require('./lib/dbase.js');
var KeyStore = require('./lib/keystore.js');
var Ui = require('./lib/ui');
var msgcrypt = require('./lib/msgcrpyt.js');
var path = require('path');

/*global $:false */
var app = {'$': $};

app.db = new DataBase();
app.keys = new KeyStore(app);

var ds = false;

var ths = new thsBuilder(opt.datadir, opt.get('socksPortNumber'), opt.get('controlPortNumber'));

app.ths = ths;

if(!ths.getServices() || ths.getServices().length ===0 || ths.getServices()[0].name != 'ddd_service'){
	ths.createHiddenService('ddd_service', '47654 ' + opt.listenPort, true);
	console.log('service created');
	console.log(ths.getServices());
}

if(!opt.get('disableNetworking')){
	ths.start(false, function(){
		console.log(ths.getServices());	
		ths.getOnionAddress('ddd_service', function(err, hostname){
			ds = new DataServer(hostname);
			$('#ths-address').text(hostname);
			app.ds = ds;

			app.db.getSendQueue().then(function(val){
				function reinseretFile(err, data) {
					if (err){
						console.log(err); 
						return false;
					}
					app.ds.insertFile(data);
				}

				for (var i = 0; i < val.length; i++) {
					fs.readFile(opt.datadir + '/temp_msg/' + val[i].id, reinseretFile);
				}
			}, function(err){console.log(err);});


			ds.dataStore.on('fileadded', function(fname){
				var content = ds.dataStore.getFile(fname), k, decMSG;

				content = content.slice(10);
				var msgHash = crpt.createHash('sha256').update(content).digest('hex');

				for(k in app.keys.subs){
					var sk = ec.keyPair({priv: bs58.decode(app.keys.subs[k].private)});
					console.log(sk);
					decMSG = msgcrypt.decodeMessage(content, sk);
					if(!decMSG) continue;
					console.log(decMSG, msgHash);
					break;
				}

				if(decMSG){
					if(decMSG.msg.parent !== 0){
						app.db.addPost({
							id: decMSG.msg.parent,
							parent: 0,
							posted_at: 0,
							bumped: decMSG.msg.timestamp,
							message: '',
							sent_to: k,
							state: 'placeholder'
						}, function(){
							app.db.bumpThread(decMSG.msg.parent, decMSG.msg.timestamp);
						});
					}

					app.db.addPost({
							id: msgHash,
							parent: decMSG.msg.parent,
							posted_at: decMSG.msg.timestamp,
							bumped: decMSG.msg.timestamp,
							message: decMSG.msg.text,
							sent_to: k,
							state: 'recieved'
						}, function(){});
					app.db.updatePost({
							id: msgHash,
							parent: decMSG.msg.parent,
							posted_at: decMSG.msg.timestamp,
							bumped: decMSG.msg.timestamp,
							message: decMSG.msg.text,
							sent_to: k,
							state: 'recieved'
						}, function(){});
					fs.unlink(opt.datadir + '/temp_msg/' + msgHash, function(){return true;});
					
				}
			});
			
			app.ui = new Ui(app);
			setTimeout(app.ui.inject.bind(app.ui), 1000);
		});

	});
}else{
	app.ui = new Ui(app);
	setTimeout(app.ui.inject.bind(app.ui), 0);
}

$('.update_bbd').on('click', function(){
	$('.update_bbd').replaceWith('<div class="update_bbd">Downloading... <i class="fa fa-refresh fa-spin"></i></div>');

	app.ths.stop();
	if(ds) ds.server.close();
	var Download = require('download');

	new Download({mode: '755', extract: true, strip: 1})
	    .get('https://github.com/desudesutalk/barabaradark/archive/master.zip')
	    .dest('.')
	    .run(function(){
			var child,
            	child_process = require("child_process"),
            	gui = require('nw.gui'),
            	win = gui.Window.get();
            if (process.platform == "darwin")  {
            	child = child_process.spawn("open", ["-n", "-a", process.execPath.match(/^([^\0]+?\.app)\//)[1]], {detached:true});
           	} else {
            	child = child_process.spawn(process.execPath, [], {detached: true, cwd: process.cwd()});
           	}
            child.unref();
            win.hide();
            gui.App.quit();	    	
	    });	
});
