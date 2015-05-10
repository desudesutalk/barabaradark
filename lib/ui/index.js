"use strict";

var utils = require('util');
var events = require('events');
var fs = require('fs');
var crpt = require('crypto');
var markup = require('./wakabamark.js');
var msgcrypt = require('../msgcrpyt.js');
var bs58 = require('bs58');
var ntp_time = require('../ntp_time.js');

var EC = require('elliptic').ec;
var ec = new EC('secp256k1');

console.log($);

var $ = null;

var dateToStr = function(date, onlyNums) {
    var dateo = new Date();
    dateo.setTime(date * 1000);

    var z = function(i) {
        if (parseInt(i) < 10) return "0" + i;
        return i;
    };

    if(onlyNums){
        return '' + dateo.getFullYear() + z(dateo.getMonth() + 1) + z(dateo.getDate())+ '_' + z(dateo.getHours()) + z(dateo.getMinutes());    
    }
    return '' + dateo.getFullYear() + '-' + z(dateo.getMonth() + 1) + '-' + z(dateo.getDate()) + ' ' + z(dateo.getHours()) + ':' + z(dateo.getMinutes());
};

var Ui = function Ui(app){
	events.EventEmitter.call(this);
	this.app = app;
	$ = app.$;
	this.state = 'messages';
	this.showSub = null;
	this.showThread = null;
	this.showPage = 0;
};
utils.inherits(Ui, events.EventEmitter);

Ui.prototype.inject = function inject(){
	var self = this;

	$('#show_contacts').on('click', function(){
		$('#header .headbutton').removeClass('selected');
		$('#pages .page').removeClass('show');
		$('#show_contacts').addClass('selected');
		$('#pages #contacts').addClass('show');
		this.state = 'contacts';
	}.bind(this));

	$('#show_subs').on('click', function(){
		$('#header .headbutton').removeClass('selected');
		$('#pages .page').removeClass('show');
		$('#show_subs').addClass('selected');
		$('#pages #subs').addClass('show');
		this.renderSubs();
		this.state = 'subs';
	}.bind(this));

	$('#show_messages').on('click', function(){
		$('#header .headbutton').removeClass('selected');
		$('#pages .page').removeClass('show');
		$('#show_messages').addClass('selected');
		$('#pages #messages').addClass('show');
		this.state = 'messages';
	}.bind(this));

	$('#add_sub_key').on('click', function(){
		this.app.keys.addSub($('#sub_address').val());
		this.renderSubs();
		$('#sub_address').val('');
	}.bind(this));

	this.renderSubs();
	$('#load_spalsh').addClass('hidden');
	$('.maincontent').removeClass('hidden');
	$('#page_refresh').on('click', function(){
		this.renderPage();
	}.bind(this));
	

};



Ui.prototype.renderSubs = function renderSubs() {

    var code = '<br>', cnt = 1, mnu = '';

    for (var c in this.app.keys.subs) {

        code += '<div class="hidbord_msg">' +
            '<div class="cont_identi" style="float: left">' + c + '</div>' +
            '<div  style="float: left; padding: 5px;"><strong>' + this.app.keys.subs[c].name + '</strong> &nbsp; [<a href="javascript:;" alt="' + c + '" class="hidbord_subs_action">delete</a>] ' +
            //'<br/><sub><i style="color: #009">' + c + '</i></sub> '+
            '</div><div style="float: right; color: #ccc;"><sup>#'+(cnt++)+'</sup></div><br style="clear: both;"/></div>';

        mnu += '<a href="javascript:;" alt="' + c + '" class="board_nav_link">' +
               '<strong>' + this.app.keys.subs[c].name + '</strong></a><br>';
    }

    var cont_list = $(code);
    var mnu_list = $(mnu);
    cont_list.find('.cont_identi').identicon5({
        rotate: true,
        size: 48
    });

/*    mnu_list.find('.cont_identi').identicon5({
        rotate: true,
        size: 18
    });*/
    
    cont_list.find('a.hidbord_subs_action').on('click', this.deleteSub.bind(this));
    //mnu_list.find('a.board_nav_link').on('click', this.navToBoard.bind(this));


    $('#subs_list').empty().append(cont_list);
    $('#msgs_menu').empty().append(mnu_list);


    $('#msgs_menu').find('a.board_nav_link').on('click', this.navToBoard.bind(this));
};

Ui.prototype.deleteSub = function deleteSub(e) {
    var action = $(e.target).text(),
        key = $(e.target).attr('alt');

    if (action == 'delete' && window.confirm('Really delete "' +  this.app.keys.subs[key].name + '" subscription?')) {
        this.app.keys.deleteSub(key);
        this.renderSubs();
    }
};

Ui.prototype.navToBoard = function navToBoard(e) {
    var key = $(e.target).parent('a').attr('alt');
    this.showSub = key;
	this.showThread = 0;
	this.showPage = 0;
	this.posts = [];

	this.renderPage();
};

Ui.prototype.renderPage = function renderPage() {
	$('#msgs_content').empty().append('<h1><div class="cont_identi" style="display: inline-block;">' + this.showSub + '</div>&nbsp;' + 
		this.app.keys.subs[this.showSub].name + '</h1>'+
		(this.showThread === 0 ? '<h3>New Thread</h3>': '<h3>Reply to '+this.showThread.substr(0, 8)+'</h3>')+
		'<form id="postform">'+
		'<sub><a href="javascript:;" id="post_edit_link">edit</a> | <a href="javascript:;" id="post_preview_link">preview</a><br></sub>'+
		'<textarea id="reply_text" rows="6" cols="40"></textarea><div id="post_preview" style="display:none;"></div><br>'+
		'<input type="button" value="Send" id="post_edit_send">'+
		'</form>'+
		'<hr><div id="thread_render"><i class="fa fa-refresh fa-spin"></i> Loading...</div><hr>'
	).find('.cont_identi').identicon5({
        rotate: true,
        size: 48
    });

    $('#msgs_content #post_preview_link').on('click', function(){
    	$('#msgs_content #post_preview').show();
    	$('#msgs_content #reply_text').hide();
    	$('#msgs_content #post_preview').empty().append(markup.wkbmrk($('#msgs_content #reply_text').val())).show();
    });

    $('#msgs_content #post_edit_link').on('click', function(){
    	$('#msgs_content #post_preview').hide();
    	$('#msgs_content #reply_text').show();
    });




    $('#msgs_content #post_edit_send').on('click', function(){
    	var message = {
    		text: $('#msgs_content #reply_text').val(),
    		timestamp: Math.floor(ntp_time.now() / 1000),
    		parent: this.showThread
    	};
    	//encodeMessage(msg, attach, contacts, signKey){
    	var packed = msgcrypt.encodeMessage(message, null, [this.showSub], null);
    	var hash = crpt.createHash('sha256').update(packed).digest();

    	fs.writeFile(this.app.datadir + 'temp_msg/' + hash.toString('hex'), packed);
		
		this.app.db.bumpThread(message.parent, message.timestamp);
		
		this.app.db.addPost({
      		"id": hash.toString('hex'), 
      		"parent":  message.parent, 
      		"posted_at": message.timestamp, 
      		"bumped":  message.timestamp, 
      		"message": message.text,
      		"sent_to": this.showSub,
      		"state": 'sending',
      	}, function(){
      		this.showPage = 0;
			this.posts = [];

			this.renderPage();
      	}.bind(this));

      	this.app.ds.insertFile(packed);

    }.bind(this));

    this.app.db.getBoardThreads(this.showSub, this.showThread, function(rows, board){
		if(board != this.showSub){
			return false;
		}
		$('#thread_render').empty();
		
		if(this.showThread !== 0 && rows.length === 0){
			this.showThread = 0;
			this.showPage = 0;
			this.posts = [];
			this.renderPage();
			return false;
		}

		this.posts = [];

		for (var i = 0; i < rows.length; i++) {
			this.posts.push(rows[i]);
			// ['id', 'parent', 'posted_at', 'name', 'message', 'sent_to'], 

			$('#thread_render').append('<div class="hidbord_msg" id="msg_' + rows[i].id + '">' +
			' <i style="color: #999;">(' + dateToStr(rows[i].posted_at) + ') <span href="javascript:;" class="hidbord_mnu_reply clickable">#'+rows[i].id.substr(0, 8)+'</span></i>'+
			(rows[i].state == 'sending' ? ' (message is in send queue)': '') +
			(rows[i].state == 'placeholder' ? ' (message is not recived. This is Placeholder)': '') +
            '    <hr style="clear:both;">'+
            markup.wkbmrk(rows[i].message) +
            '</div>');

		}

		$('#thread_render .hidbord_mnu_reply').on('click', function(e){
			var key = $(e.target).parents('.hidbord_msg').attr('id').replace(/^msg_/, '');
				this.showThread = key;
				this.showPage = 0;
				this.posts = [];
				this.renderPage();
		}.bind(this));
	}.bind(this));
};




module.exports = Ui;