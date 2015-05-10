"use strict";

var ntpClient = require('ntp-client');

var tDiff = 0,
	lastUpdate = Date.now();

function checkNtp(){
	ntpClient.getNetworkTime("pool.ntp.org", 123, function(err, date) {
		var now = new Date();    
		
		lastUpdate += 30*60*1000;
		
		if(err) {
	        console.error('ntp error: ', err);
	        return;
	    }

	    tDiff = date.getTime() - now.getTime();
	    lastUpdate = Date.now();

	    console.log('Time diff with ntp server: ' + tDiff + 'ms');
	});
}

checkNtp();

exports = module.exports = {
	now: function(){
		if(Date.now() - lastUpdate > 12*60*60*1000) checkNtp();

		return Date.now() + tDiff;
	},

	new: function(){
		if(Date.now() - lastUpdate > 12*60*60*1000) checkNtp();

		var d = new Date();

		d.setTime(d.getTime() + tDiff);

		return d;
	}
};
