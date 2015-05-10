"use strict";

var crpt = require('crypto');
var cp   = require('child_process');
var opt  = require('./options.js');

function calcComplexity(size){
	if(size < 16384) size = 16384;
	var complexity = size / (2 * 1024 * 1024);
	return 2097152 - 1835008 * complexity;
}

var isRuning = false,
	jobs = [],
	threads = [];

function _calcPOW(data, trails, cb, cb2){
	var numThreads = opt.get('powThreads'), i;

	function powCalculated(m){
		for (var i = 0; i < threads.length; i++) {
			threads[i].kill();
		}
		
		cb(m.msgHash, m.nonce, cb2);
	}

	threads = [];
	for (i = 0; i < numThreads; i++) {
		threads[i] = cp.fork(__dirname + '/poworker.js');
		threads[i].on('message', powCalculated);
	}

	for (i = 0; i < numThreads; i++) {
		threads[i].send({msgHash: data, start: i, step: numThreads, trails: trails});
	}
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
	var trails = calcComplexity(size),
		shasum = crpt.createHash('sha256'),
		pow, trail;
	
	pow = shasum.update(nonce).update(data).digest();
	trail = pow.readUIntBE(2, 4);

	if(pow[0] === 0 && pow[1] === 0 && trail <= trails) {
		return true;
	}

	return false;
};
