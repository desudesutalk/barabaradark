var crpt = require('crypto');
var cp     = require('child_process');

function calcComplexity(size){
	return size / (2 * 1024 * 1024);
}

var isRuning = false,
	jobs = [];

function _calcPOW(data, complexity, cb, cb2){
	var trails = 2097152 - 1835008 * complexity;

	var w1 = cp.fork(__dirname + '/poworker.js');
	var w2 = cp.fork(__dirname + '/poworker.js');
	var w3 = cp.fork(__dirname + '/poworker.js');
	var w4 = cp.fork(__dirname + '/poworker.js');

	function powCalculated(m){
		w1.kill();
		w2.kill();
		w3.kill();
		w4.kill();
		
		cb(m.msgHash, m.nonce, cb2);
	}

	w1.on('message', powCalculated);
	w2.on('message', powCalculated);
	w3.on('message', powCalculated);
	w4.on('message', powCalculated);

	w1.send({msgHash: data, start: 0, step: 4, trails: trails});
	w2.send({msgHash: data, start: 1, step: 4, trails: trails});
	w3.send({msgHash: data, start: 2, step: 4, trails: trails});
	w4.send({msgHash: data, start: 3, step: 4, trails: trails});
}

function powProcessor(hash, nonce, cb){
	cb(hash, nonce);
	if(jobs.length === 0){
		isRuning = false;
		return true;
	}

	isRuning = true;
	var job = jobs.shift();
	_calcPOW(job.data, job.complexity, powProcessor, job.cb);
}

exports.calc = function calcPOW(data, size, cb){
	jobs.push({data: data, complexity: calcComplexity(size), cb: cb});

	if(isRuning) return true;

	isRuning = true;
	var job = jobs.shift();

	_calcPOW(job.data, job.complexity, powProcessor, job.cb);
};

exports.check = function checkPOW(data, nonce, size){
	var complexity = calcComplexity(size);
	var trails = 2097152 - 1835008 * complexity,
		shasum = crpt.createHash('sha256'),
		pow, trail;
	
	shasum.update(nonce);
	shasum.update(data);
	pow = shasum.digest(),
	trail = pow.readUIntBE(2, 4);
	console.log(pow);
	if(pow[0] === 0 && pow[1] === 0 && trail <= trails) {
		return true;
	}

	return false;
}  
