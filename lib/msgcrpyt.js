"use strict";

var EC = require('elliptic').ec;
var crpt = require('crypto');
var bs58 = require('bs58');
var zlib = require('zlib');

var ECcrypt = new EC('secp256k1');

exports.encodeMessage = function encodeMessage(msg, attach, contacts, signKey){
	var key = crpt.randomBytes(32),
		iv  = crpt.randomBytes(16),
		ephemeralKey = ECcrypt.genKeyPair(),
		ephemeralBuf = new Buffer(ephemeralKey.getPublic(true, 'hex'), 'hex'), 
		shasum, i, j;

	key[31] = 0xAA;	

	var msgBuffer = new Buffer('DEADBEEF00000000000000000000000000', 'hex'),
		flags = 0;

	var compressedMsg = zlib.deflateRawSync(new Buffer (JSON.stringify(msg)));
	
	if(attach) flags |= 1;
	if(signKey) flags |= 2;

	msgBuffer[4] = flags;

	msgBuffer.writeUIntBE(contacts.length, 5, 4);
	msgBuffer.writeUIntBE(compressedMsg.length, 9, 4);

	msgBuffer = Buffer.concat([msgBuffer, compressedMsg]);

	if(attach) {
		msgBuffer = Buffer.concat([msgBuffer, attach]);
		msgBuffer.writeUIntBE(attach.length, 13, 4);
	}

	var secrets = new Buffer(0), sharedSecret;

	for (i = 0; i < contacts.length; i++) {
		shasum = crpt.createHash('sha256');

		shasum.update(new Buffer(ephemeralKey.derive(ECcrypt.keyPair({pub: bs58.decode(contacts[i])}).getPublic()).toArray()));
		sharedSecret = shasum.digest();

		
		for (j = 0; j < 32; j++) {
			sharedSecret[j] ^= key[j];
		}

		secrets = Buffer.concat([secrets, sharedSecret]);
	}

	var msgHash, sig;

	if(signKey){
		shasum = crpt.createHash('sha256');
		shasum.update(ephemeralBuf);
		shasum.update(iv);
		shasum.update(secrets);
		shasum.update(msgBuffer);
		msgHash = shasum.digest();

		console.log('sig hash: ', msgHash);

		sig = new Buffer(signKey.sign(msgHash).toDER());
		msgBuffer = Buffer.concat([msgBuffer, sig]);
	}

	var aes = crpt.createCipheriv('aes-256-cfb8', key, iv);
	
	return Buffer.concat([
		ephemeralBuf, 
		iv,
		aes.update(msgBuffer.slice(0,16)),
		secrets,
		aes.update(msgBuffer.slice(16)),
		aes.final()
	]);

};

exports.decodeMessage = function decodeMessage(msg, forKey){
	var ephemeral = msg.slice(0, 33),
		iv = msg.slice(33, 49),
		contHead = msg.slice(49, 65),
		secrets = msg.slice(65),
		firstByte = 0xAA,
		secret, shasum,
		message = {},
		sessionKey = new Buffer(32);

	try {
		shasum = crpt.createHash('sha256');
		shasum.update(new Buffer(forKey.derive(ECcrypt.keyPair({pub: ephemeral}).getPublic()).toArray()));
		secret = shasum.digest();

        firstByte ^= secret[31];
    } catch (exception) {
    	console.log('eph err');
        return false;
    }

    var shift = 0, i;

    while(shift < secrets.length){
    	if(firstByte != secrets[shift + 31]){
            shift += 32;
            continue;
        }

        for (i = 0; i < 32; i++) {
            sessionKey[i] = secrets[i + shift] ^ secret[i];
        }

        var aes = crpt.createDecipheriv('aes-256-cfb8', sessionKey, iv);
        var res = aes.update(contHead);

        // [ 68, 69, 83, 85 ]
        if(res[0] == 0xDE  && res[1] == 0xAD  && res[2] == 0xBE  && res[3] == 0xEF){
			message.contactsNum = res.readUIntBE(5, 4);

			secrets = msg.slice(65, 65 + 32 * message.contactsNum);

			res = Buffer.concat([res, aes.update(msg.slice(65 + 32 * message.contactsNum)), aes.final()]);

			message.hasAttach = !!(res[4] & 1);
            message.signed = !!(res[4] & 2);
            
            var cmpSize = res.readUIntBE(9, 4),
            	attSize = res.readUIntBE(13, 4),
            	sig = null,
            	msgHash, pubSigKey;
			
			message.msg = JSON.parse(zlib.inflateRawSync(res.slice(17, 17 + cmpSize)).toString());

			if(message.hasAttach){
				message.attach = res.slice(17 + cmpSize, 17 + cmpSize + attSize);
			}

			if(message.signed && message.msg.sender){
				sig = res.slice(17 + cmpSize + attSize);
				shasum = crpt.createHash('sha256');
				shasum.update(ephemeral);
				shasum.update(iv);
				shasum.update(secrets);
				shasum.update(res.slice(0, 17 + cmpSize + attSize));
				msgHash = shasum.digest();

				console.log('sig hash: ', msgHash);

				pubSigKey = ECcrypt.keyPair({pub: bs58.decode(message.msg.sender)});

				if(!pubSigKey.verify(msgHash, sig)){
					console.log('sign fail');
                    return false; 
                }

                message.signatureOk = true;
			}

			return message;
		}
    }
    console.log('cant decod');
    return false;
};
