"use strict";

var dblite = require('dblite');

var DataBase =  function DataBase(dataDir){
	this.db = dblite(dataDir + 'posts.db');
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

DataBase.prototype.getBoardThreads = function getBoardThreads(board, thread, cb){
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

DataBase.prototype.addPost = function addPost(post, cb){
	this.db.query('INSERT INTO posts (id, parent, posted_at, bumped, message, sent_to, state) ' +
		          'SELECT ?, ?, ?, ?, ?, ?, ? '+
		          'WHERE NOT EXISTS(SELECT id FROM posts WHERE id = ?)',
	    		[post.id, post.parent, post.posted_at, post.bumped, post.message, post.sent_to, post.state, post.id], function(){ cb();});
};

DataBase.prototype.updatePost = function updatePost(post, cb){
	this.db.query('UPDATE posts SET parent = ?, posted_at = ? , bumped = ?, message = ?, sent_to = ?, state = ? WHERE id = ?',
	    		[post.parent, post.posted_at, post.bumped, post.message, post.sent_to, post.state, post.id], function(){ cb();});
};

DataBase.prototype.bumpThread = function bumpThread(id, bump){
	this.db.query('UPDATE posts SET bumped = ? WHERE id = ?', [bump, id]);
};



module.exports = DataBase;