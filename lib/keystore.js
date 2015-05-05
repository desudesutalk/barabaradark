var utils = require('util');
var events = require('events');
var EC = require('elliptic').ec;
var crpt = require('crypto');
var bs58 = require('bs58');
var ec = new EC('secp256k1');

var KeyStore = function KeyStore(app){
	events.EventEmitter.call(this);
	this.app = app;
	this.subs = {};
	this.contacts = {};

	this.app.db.getKeys(function(rows){
		console.log(rows);
		if(rows.length === 0){
			this.addSub('Broadcast');
		}

		for (var i = 0; i < rows.length; i++) {
			this.subs[rows[i].id] = rows[i];
		};
	}.bind(this));

};
utils.inherits(KeyStore, events.EventEmitter);

KeyStore.prototype.addSub = function addSub(name){
	var shasum, msgHash = new Buffer(name, 'utf8'), keypair;

	while(true){
		shasum = crpt.createHash('sha256');
		shasum.update(msgHash);
		msgHash = shasum.digest();
		keypair = ec.keyPair({priv: msgHash});

		try{
	        if(!keypair.validate().result){
	            continue;
	        }
	    } catch (e) {
	        continue;
	    }

	    break;
	}

	var privare = bs58.encode(msgHash),
		publicKey = keypair.getPublic(true, 'hex'),	    
	    id = bs58.encode(new Buffer(publicKey, 'hex'));

	if(id in this.subs) return false;

	console.log({
		id: id,
		name: name,
		type: 'subscription',
		private: privare
	});

	this.subs[id] = {
		id: id,
		name: name,
		type: 'subscription',
		private: privare
	};

	this.app.db.insertKey(this.subs[id]);
};

KeyStore.prototype.deleteSub = function deleteSub(id){
	this.subs[id] = undefined;
	delete this.subs[id];
	this.app.db.deleteKey(id);
};



module.exports = KeyStore;