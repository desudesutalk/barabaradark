"use strict";

var opt  = require('./options.js');
var dblite = require('dblite');

var DataBase =  function DataBase(dataDir){
	this.db = dblite(opt.datadir + '/posts.db');
};

DataBase.prototype.getKeys = function getList(cb){
	this.db.query('SELECT * FROM keys', ['id', 'type', 'private', 'name'], function(err, rows){
		cb(rows);
	});
};

DataBase.prototype.insertKey = function insertKey(data){
	this.db.query('INSERT INTO keys(id, name, type, private) VALUES(?, ?, ?, ?)', 
		[data.id, data.name, data.type, data.private]);
};

DataBase.prototype.deleteKey = function deleteKey(id){
	this.db.query('DELETE from keys WHERE id = ?', [id]);
};

/*
CREATE TABLE `posts` (
	`id`	TEXT UNIQUE,
	`parent`	TEXT NOT NULL,
	`timestamp`	INTEGER NOT NULL,
	`bumped`	INTEGER NOT NULL,
	`name`	TEXT,
	`email`	TEXT,
	`subject`	TEXT,
	`message`	TEXT,
	`file`	TEXT,
	`file_size`	INTEGER DEFAULT '0',
	`file_ext`	TEXT,
	`sender`	TEXT,
	`contacts`	TEXT,
	`sig_ok`	INTEGER,
	`sent_to`	TEXT,
	`state`	TEXT,
	`post_blob`	BLOB,
	PRIMARY KEY(id)
);
*/

DataBase.prototype.getBoardThreads = function getBoardThreads(board, thread, page, cb){
	if(thread){
		this.db.query('SELECT id, parent, posted_at, bumped, message, sent_to, state FROM posts WHERE sent_to = ? AND (parent = ? OR (id = ? AND parent = 0)) ORDER BY posted_at asc',
		     [board, thread, thread], ['id', 'parent', 'posted_at', 'bumped', 'message', 'sent_to', 'state'],
		    function(err, rows){
				cb(rows, board);
			});
	}else{
		this.db.query('SELECT id, parent, posted_at, bumped, message, sent_to, state FROM posts WHERE sent_to = ? AND parent = 0 ORDER BY bumped desc',
		     [board, thread], ['id', 'parent', 'posted_at', 'bumped', 'message', 'sent_to', 'state'],
		    function(err, rows){
				cb(rows, board);
			});
	}
};


DataBase.prototype.getBoardPages = function getBoardPages(board){
	return new Promise(function(resolve, reject){		
		this.db.query('SELECT count(*) as count FROM posts WHERE sent_to = ? AND parent = 0', [board], ['count'],
		    function(err, rows){
		    	if(err){
		    		reject(err);
		    	}else{
		    		resolve({board: board, threads: rows[0].count});
		    	}				
			});
	}.bind(this));
};

DataBase.prototype.getLastNPosts = function getLastNPosts(thread, num){
	return new Promise(function(resolve, reject){		
		this.db.query('SELECT id, parent, posted_at, bumped, message, sent_to, state FROM posts WHERE parent = ? ORDER BY posted_at desc LIMIT ?', 
			[thread, num], ['id', 'parent', 'posted_at', 'bumped', 'message', 'sent_to', 'state'],
		    function(err, rows){
		    	if(err){
		    		reject(err);
		    	}else{
		    		resolve({thread: thread, replies: rows});
		    	}				
			});
	}.bind(this));
};

DataBase.prototype.getPost = function getLastNPosts(id){
	return new Promise(function(resolve, reject){		
		this.db.query('SELECT id, parent, posted_at, bumped, message, sent_to, state FROM posts WHERE id = ?', 
			[id], ['id', 'parent', 'posted_at', 'bumped', 'message', 'sent_to', 'state'],
		    function(err, rows){
		    	if(err){
		    		reject(err);
		    	}else{
		    		if(rows.length != 1){
		    			reject(null);	
		    		}else{
		    			resolve(rows[0]);
		    		}
		    	}
			});
	}.bind(this));
};

DataBase.prototype.getPage = function getPage(board, page, perPage, perThread){
	return new Promise(function(resolve, reject){			
		this.db.query('SELECT p.id, parent, posted_at, bumped, message, sent_to, state, n.post_count FROM posts p LEFT JOIN (SELECT parent as th, count(id) as post_count FROM posts t WHERE t.parent != 0 GROUP BY parent) n ON p.id = n.th '+
		'WHERE p.parent = 0 AND sent_to = ? ORDER by bumped desc LIMIT ? OFFSET ?', [board, perPage, perPage * page], ['id', 'parent', 'posted_at', 'bumped', 'message', 'sent_to', 'state', 'post_count'],
		    function(err, rows){
		    	if(err){
		    		reject(err);
		    	}else{
		    		if(rows.length === 0){
		    			resolve([]);
		    			return true;
		    		}
		    		var threads = [], i;

		    		for (i = 0; i < rows.length; i++) {
		    			rows[i].post_count = parseInt(rows[i].post_count);
		    			if(rows[i].post_count && rows[i].post_count > 0){
		    				threads.push(this.getLastNPosts(rows[i].id, perThread));
		    			}else{
		    				rows[i].post_count = 0;
		    			}
		    		}

		    		Promise.all(threads).then(function(val){
		    			
		    			var r = {};
		    			for (i = 0; i < val.length; i++) {
			    			r[val[i].thread] = val[i].replies;
			    		}
			    		

			    		for (i = 0; i < rows.length; i++) {
			    			
			    			if(r[rows[i].id]){
			    				rows[i].replies = r[rows[i].id].reverse();
			    			}else{
			    				rows[i].replies = [];
			    			}
			    		}
			    		
			    		resolve(rows);
		    		}.bind(this), function(err){reject(err);});
		    	}				
			}.bind(this));
	}.bind(this));
};

DataBase.prototype.getSendQueue = function getSendQueue(){
	return new Promise(function(resolve, reject){		
		this.db.query('SELECT id FROM posts WHERE state = "sending" ORDER BY posted_at asc', ['id'],
		    function(err, rows){
		    	if(err){
		    		reject(err);
		    	}else{
		    		resolve(rows);
		    	}				
			});
	}.bind(this));
};



DataBase.prototype.addPost = function addPost(post, cb){
	this.db.query('INSERT INTO posts (id, parent, posted_at, bumped, message, sent_to, state) ' +
		          'SELECT ?, ?, ?, ?, ?, ?, ? '+
		          'WHERE NOT EXISTS(SELECT id FROM posts WHERE id = ?)',
	    		[post.id, post.parent, post.posted_at, post.bumped, post.message, post.sent_to, post.state, post.id], function(){ cb();});
};

DataBase.prototype.updatePost = function updatePost(post, cb){
	this.db.query('UPDATE posts SET parent = ?, posted_at = ? , message = ?, sent_to = ?, state = ? WHERE id = ?',
	    		[post.parent, post.posted_at, post.message, post.sent_to, post.state, post.id], function(){ cb();});
};

DataBase.prototype.bumpThread = function bumpThread(id, bump){
	this.db.query('UPDATE posts SET bumped = ? WHERE id = ? AND bumped < ?', [bump, id, bump]);
};



module.exports = DataBase;