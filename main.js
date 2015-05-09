var win = require('nw.gui');
$('.open_dev_tools').on('click', function(){
	win.Window.get().showDevTools();
});

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


var app = {'$': $};

var datadir = './data/';
app.datadir = datadir;

var dataFiles = fs.readdirsync(datadir);
if(dataFiles.indexOf('posts.db') == -1){
	fs.renameSync(datadir + 'posts.emptydb', datadir + 'posts.db');
}
if(dataFiles.indexOf('peerlist.json') == -1){
	fs.renameSync(datadir + 'bootstrap.json', datadir + 'peerlist.json');
}

var opt;
try { 
	opt = JSON.parse(fs.readFileSync(datadir + 'options.json', 'utf8'));
}catch(e){
	opt ={
		socksPortNumber: 9999,
		controlPortNumber: 9998,
		listenPort: 47654,
		uiPort: 8810
	};
	fs.writeFile(datadir + 'options.json', JSON.stringify(opt, null, 2));
}

app.opt = opt;

app.db = new DataBase(datadir);
app.keys = new KeyStore(app);

var ds;// = new DataServer(datadir, opt.listenPort, opt);

var ths = new thsBuilder(path.resolve(datadir), opt.socksPortNumber, opt.controlPortNumber);

app.keys = ths;

if(!ths.getServices() || ths.getServices().length ===0 || ths.getServices()[0].name != 'ddd_service'){
	ths.createHiddenService('ddd_service', '47654 ' + opt.listenPort, true);
	console.log('service created');
	console.log(ths.getServices());
}

ths.start(false, function(){
	console.log(ths.getServices());	
	ths.getOnionAddress('ddd_service', function(err, hostname){
		ds = new DataServer(datadir, hostname, opt);
		app.ds = ds;


		ds.dataStore.on('fileadded', function(fname){
			var content = ds.dataStore.getFile(fname);

			content = content.slice(10);
			var msgHash = crpt.createHash('sha256').update(content).digest('hex');

			for(k in app.keys.subs){
				var sk = ec.keyPair({priv: bs58.decode(app.keys.subs[k].private)});
				console.log(sk);
				var decMSG = msgcrypt.decodeMessage(content, sk);
				if(!decMSG) continue;
				console.log(decMSG, msgHash);

				if(decMSG.msg.parent != 0){
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
				fs.unlink(app.datadir + '/temp_msg/' + msgHash, function(){return true;});
				break;
			}
		});
		
		app.ui = new Ui(app);
		setTimeout(app.ui.inject.bind(app.ui), 1000);
	});

});



















