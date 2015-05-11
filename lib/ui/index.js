"use strict";

var opt  = require('../options.js');
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
		$('nav>ul li').removeClass('active');
		$('#page-wrapper .page').removeClass('show');
		$('#show_contacts').parent().addClass('active');
		$('#page-wrapper #contacts').addClass('show');
		this.state = 'contacts';
	}.bind(this));

	$('#show_subs').on('click', function(){
		$('nav>ul li').removeClass('active');
		$('#page-wrapper .page').removeClass('show');
		$('#show_subs').parent().addClass('active');
		$('#page-wrapper #subs').addClass('show');
		this.renderSubs();
		this.state = 'subs';
	}.bind(this));

	$('#show_messages').on('click', function(){
		$('nav>ul li').removeClass('active');
		$('#page-wrapper .page').removeClass('show');
		$('#show_messages').parent().addClass('active');
		$('#page-wrapper #messages').addClass('show');
		this.state = 'messages';
	}.bind(this));

	$('#add_sub_key').on('click', function(){
		this.app.keys.addSub($('#sub_address').val());
		this.renderSubs();
		$('#sub_address').val('');
	}.bind(this));

	this.renderSubs();
	$('#load_spalsh').addClass('hidden');
	$('#wrapper').removeClass('hidden');
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
            '</div><div style="float: right; color: #ccc;"><sup>#'+(cnt++)+'</sup></div><br style="clear: both;"/></div>';
        mnu += '<li' + (this.showSub == c ? ' class="active"' : '') + 
            '><a href="#" alt="' + c + '" class="board_nav_link">' + this.app.keys.subs[c].name + '</a></li>';
    }

    var cont_list = $(code);
    var mnu_list = $(mnu);
    cont_list.find('.cont_identi').identicon5({
        rotate: true,
        size: 48
    });
    
    cont_list.find('a.hidbord_subs_action').on('click', this.deleteSub.bind(this));

    $('#subs_list').empty().append(cont_list);
    $('.side-nav ul').empty().append(mnu_list);


    $('.side-nav ul').find('a.board_nav_link').on('click', this.navToBoard.bind(this));
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
    var key = $(e.target).attr('alt');
    this.showSub = key;
	this.showThread = 0;
	this.showPage = 0;
	this.posts = [];

	$('.side-nav ul li').removeClass('active');
	$('.side-nav ul li a[alt='+key+']').parent().addClass('active');

	this.renderPage();
};

Ui.prototype.renderPage = function renderPage() {
	$('#messages').empty().append('<h1 class="page-header"><div class="cont_identi" style="display: inline-block;">' + this.showSub + '</div>&nbsp;' + 
		this.app.keys.subs[this.showSub].name + '</h1>'+	

		'<br><div class="panel panel-default op" id="reply_form">'+
            	'	<div class="panel-heading">'+
            	(this.showThread === 0 ? '<strong>Create new Thread</strong>': 'Reply to #'+this.showThread.substr(0, 8))+
            	'    </div>'+
            	'    <div class="panel-body">'+
            	'        <div>'+
				'<form id="postform">'+
				
				'<textarea id="reply_text" rows="6" cols="60"></textarea><div id="post_preview" style="display:none;" ></div><br>'+
				'<input type="button" value="Send" id="post_edit_send">'+

				'&nbsp;<sub><a href="javascript:;" id="post_edit_link">edit</a> | <a href="javascript:;" id="post_preview_link">preview</a><br></sub>'+
				'</form>'+

            	'        </div>'+
            	'    </div>'+
            	'</div>'+

		'<div id="thread_render"><i class="fa fa-refresh fa-spin"></i> Loading...</div><hr><div id="board_pagination"></div>'

	).find('.cont_identi').identicon5({
        rotate: true,
        size: 48
    });

    $('#reply_form #post_preview_link').on('click', function(){
    	$('#reply_form #post_preview').show();
    	$('#reply_form #reply_text').hide();
    	$('#reply_form #post_preview').empty().append(markup.wkbmrk($('#reply_form #reply_text').val())).show();
    });

    $('#reply_form #post_edit_link').on('click', function(){
    	$('#reply_form #post_preview').hide();
    	$('#reply_form #reply_text').show();
    });

    if(this.showThread == '0'){
    	this.app.db.getBoardPages(this.showSub)
    	.then(function(val){
    			console.dir(val);
	    		if(val.board == this.showSub && this.showThread == '0')
	    			this.makePagination(val.threads);
	    	}.bind(this), 
	    	function(err){
	    		throw err;
	    	});
    }

    $('#reply_form #post_edit_send').on('click', function(){
    	var message = {
    		text: $('#reply_form #reply_text').val(),
    		timestamp: Math.floor(ntp_time.now() / 1000),
    		parent: this.showThread
    	};

    	var packed = msgcrypt.encodeMessage(message, null, [this.showSub], null);
    	var hash = crpt.createHash('sha256').update(packed).digest();

    	fs.writeFile(opt.datadir + '/temp_msg/' + hash.toString('hex'), packed);
		
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

    if(this.showThread !== 0){
	    this.app.db.getBoardThreads(this.showSub, this.showThread, this.showPage, function(rows, board){
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
	            $('#thread_render').append(this.renderMsg(rows[i]));
			}

			this.bindEvents('#thread_render');		
		}.bind(this));
	}else{
		this.app.db.getPage(this.showSub, this.showPage, 10, 3)
		    .then(function(val){
		    	var i, j;

		    	$('#thread_render').empty();
		      	
		      	for (i = 0; i < val.length; i++) {
		      		
		      		this.posts.push(val[i]);
		      		$('#thread_render').append(this.renderMsg(val[i]));
		      		
		      		if(val[i].post_count > 3){
		      			$('#thread_render').append('<br><span style="margin-left: 100px;">' + (val[i].post_count - 3) + 
		      				' posts omitted.  [<a href="" class="thread_reply" data-id="'+val[i].id+'">Reply</a>]</span>');
		      		}else{
		      			$('#thread_render').append('<br><span style="margin-left: 100px;">[<a href="" class="thread_reply" data-id="'+val[i].id+'">Reply</a>]</span>');
		      		}

		      		for (j = 0; j < val[i].replies.length; j++) {
		      			$('#thread_render').append(this.renderMsg(val[i].replies[j]));		      			
		      		}
		      	}
		      	this.bindEvents('#thread_render');
		    }.bind(this), function(val){throw val;});
	}
};

Ui.prototype.renderMsg = function renderMsg(data) {
    return (data.parent == '0' ? '<hr>': '<br>')+
    	'<div class="panel panel-default'+ (data.parent == '0' ? ' op': ' reply') +
    	(data.state == 'sending' || data.state == 'placeholder' ? ' temp_msg' : '') +'" id="msg_' + data.id + '">'+
    	'	<div class="panel-heading">'+
    	'        <span class="idntcn2"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASBAMAAACk4JNkAAAAMFBMVEUDAwMYGBgoKCg3NzdHR0dZWVlnZ2d4eHiIiIiYmJivr6+7u7vHx8fY2Njo6Oj6+vqWnH1mAAAAlUlEQVQI12NgQABGqakhbopgZvz///8PghgC9UDWCwEQSzH3/1MBJqAygXkOewVMhRgYmBRWNJ9iDQGxDF6lvTESTgSyAoAa/r3fDFSXWHPu/58bTkC9Sczn/l93AOplCGKZ26LTwAhkqSq1MjMqgExmK6g5NY0BxGKarLshCeKYTM4HS0A0cxCbwQQHEKsskSEQLAUAMvIuCOWCTMQAAAAASUVORK5CYII=" title="Anonymous" alt="Anonymous" style="vertical-align: bottom;"></span>&nbsp;'+
    	'<strong>Anonymous</strong>'+
    	' <i style="color: #999;">(' + dateToStr(data.posted_at) + ') <span href="javascript:;" class="hidbord_mnu_reply hidbord_clickable">#'+data.id.substr(0, 8)+'</span></i>'+
    	(data.state == 'sending' ? ' (message is in send queue)': '') +
		(data.state == 'placeholder' ? ' (message is not recived. This is Placeholder)': '') +
    	'    </div>'+
    	'    <div class="panel-body">'+
    	'        <div>'+
    	markup.wkbmrk(data.message) +
    	'        </div>'+
    	'    </div>'+
    	'</div>';
};

Ui.prototype.makePagination = function makePagination(numThreads) {
    var numPages = Math.ceil(numThreads / 10),
    	code = '<nav><ul class="pagination">', i;

	for (i = 0; i < numPages; i++) {
		code += '<li' + (this.showPage == i ? ' class="active"' : '') + '><a href="#">' + i +'</a></li>';
	}

	code += '</ul></nav>';


    $('#board_pagination').empty().append(code);

    $('#board_pagination a').on('click', function(e){
    	var key = parseInt($(e.target).text());
				this.showPage = key;
				this.posts = [];
				this.renderPage();
    }.bind(this));
};

Ui.prototype.bindEvents = function bindEvents(selector) {
	$(selector).find('a.thread_reply').on('click', function(e){
			e.preventDefault();
			e.stopPropagation();
			this.showThread = e.target.dataset.id;
			this.showPage = 0;
			this.posts = [];
			this.renderPage();			
		}.bind(this));
};

module.exports = Ui;
