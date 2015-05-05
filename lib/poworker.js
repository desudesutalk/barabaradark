var crpt = require('crypto');

process.on('message', function(m) {
	var data = new Buffer(m.msgHash, 'base64'),
		nonce = new Buffer(6),
		cnt = m.start,
		step = m.step,
		trails = m.trails, trail;

	while(true){
		nonce.writeUIntBE(cnt, 0, 6);
		shasum = crpt.createHash('sha256');

		shasum.update(nonce);
		shasum.update(data);
		pow = shasum.digest();
		cnt += step;

		trail = pow.readUIntBE(2, 4);

		if(pow[0] === 0 && pow[1] === 0 && trail <= trails) {
			process.send({ msgHash: data.toString('base64'), nonce: nonce.toString('base64'), start: m.start, cnt: cnt, POW: pow.toString('hex')});
			break;
		}
	}  
});
