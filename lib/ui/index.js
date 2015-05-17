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

var _spoilerTag  = "%" + "%";

var $ = null, quotedText = '';

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
	
	$('#brand-version').html('<b>BaraBaraDark</b> v'+opt.pkg.version);
	
	$('#saveFileDialog').on('change', function(e){
		if(e.target.files.length === 0) return false;

		fs.readFile(opt.datadir + '/files/' + e.target.dataset.id, function (err, data) {
		  if (err) throw err;
		  fs.writeFile(e.target.files[0].path, data, function (err) {
			  if (err) throw err;
			  console.log('saved ' + e.target.dataset.id + ' to ' + e.target.files[0].path);
			  e.target.value = null;
			});
		});
    });
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
	this.posts = {};
	this.postsIds = [];

	$('.side-nav ul li').removeClass('active');
	$('.side-nav ul li a[alt='+key+']').parent().addClass('active');

	this.renderPage();
};

Ui.prototype.renderPage = function renderPage() {
	$('#messages').empty().append('<h1 class="page-header"><div class="cont_identi" style="display: inline-block;">' + this.showSub + '</div>&nbsp;' + 
		this.app.keys.subs[this.showSub].name + '</h1>'+	

		'<div id="reply_form" style="margin-left: 50px;"><div class="panel panel-default op">'+
            	'	<div class="panel-heading">'+
            	(this.showThread === 0 ? '<strong>Create new Thread</strong>': 'Reply to #'+this.showThread.substr(0, 8))+
            	'    </div>'+
            	'    <div class="panel-body">'+
            	'        <div>'+
				'<form id="postform">'+
				

	            '            <div class="btn-group btn-group-sm" role="group" style="float: right;" id="hidbordTextControls">' +
	            '              <button type="button" class="btn btn-default" title="Bold"    id="hidbordBtBold"    data-mode="B"><strong>B</strong></button>' +
				'              <button type="button" class="btn btn-default" title="Italic"  id="hidbordBtItalic"  data-mode="i"><em>i</em></button>' +
				'              <button type="button" class="btn btn-default" title="Strike"  id="hidbordBtStrike"  data-mode="S"><del>S</del></button>' +
				'              <button type="button" class="btn btn-default" title="Spoiler" id="hidbordBtSpoiler" data-mode="%">%</button>' +
				'              <button type="button" class="btn btn-default" title="Code"    id="hidbordBtCode"    data-mode="C"><code>js</code></button>' +
				'              <button type="button" class="btn btn-default" title="Irony"   id="hidbordBtIrony"   data-mode=":)"><span style="color: #ee0000; font-style: italic;">:)</span></button>' +
				'              <button type="button" class="btn btn-default" title="Spoiler" id="hidbordBtQuote"   data-mode="q">&gt;</button>' +
	            '            </div>'+ 
				'        <input type="file" id="c_file" name="c_file" style="max-width: 300px;" data-id="file_selector">' +

				'<textarea id="reply_text" rows="6" cols="70"></textarea><div id="post_preview" style="display:none;" ></div><br>'+
				'<input type="button" value="'+(this.showThread === 0 ? 'New Thread': 'Reply')+'" id="post_edit_send">'+

				'&nbsp;<sub style="float: right;"><a href="javascript:;" id="post_edit_link">edit</a> | <a href="javascript:;" id="post_preview_link">preview</a><br></sub>'+
				'</form>'+

            	'        </div>'+
            	'    </div>'+
            	'</div></div>'+

		'<div id="thread_render"><i class="fa fa-refresh fa-spin"></i> Loading...</div><hr><div id="board_pagination"></div>'

	).find('.cont_identi').identicon5({
        rotate: true,
        size: 48
    });

    $('#hidbordBtQuote').on('mouseover', function(e) {            
        quotedText = markup.quoteSelection();
    });

    $('#hidbordTextControls button').on('click', function(e) {
        var mode = this.dataset.mode,
            ta = $('textarea#reply_text'),
            taStart = ta[0].selectionStart,
            taEnd = ta[0].selectionEnd,
            taPost = ta.val().length - taEnd, tag, selected, parts;

        if (mode == 'q') {
            if (taStart !== taEnd && quotedText.length === 0) {
                quotedText = ta.val().substring(taStart, taEnd);
            }
            if (quotedText.length > 0) {
                //quotedText = '> ' + quotedText.replace(/\n/gm, "\n> ") + "\n";
                ta.val(ta.val().substring(0, taStart) + quotedText + ta.val().substring(taEnd));
            }
        }

        if (mode == 'B' || mode == 'i' || mode == 'S' || mode == ':)') {
            tag = mode == 'B' ? '**' : '*';
            tag = mode == 'S' ? '--' : tag;
            tag = mode == ':)' ? '++' : tag;
             selected = ta.val().substring(taStart, taEnd).split("\n");
            for (var i = 0; i < selected.length; i++) {
                parts = selected[i].match(/^(\s*)(.*?)(\s*)$/);
                selected[i] = parts[1] + tag + parts[2] + tag + parts[3];
            }
            ta.val(ta.val().substring(0, taStart) + selected.join("\n") + ta.val().substring(taEnd));
        }

        if (mode == '%' || mode == 'C') {
            tag = mode == '%' ? _spoilerTag : '`';
            var tagmultiline = mode == '%' ? _spoilerTag : '``';
            selected = ta.val().substring(taStart, taEnd).split("\n");

            if (selected.length > 1) {
                selected = "\n" + tagmultiline + "\n" + selected.join("\n") + "\n" + tagmultiline + "\n";
            } else {
                parts = selected[0].match(/^(\s*)(.*?)(\s*)$/);
                selected = parts[1] + tag + parts[2] + tag + parts[3];
            }
            ta.val(ta.val().substring(0, taStart) + selected + ta.val().substring(taEnd));
        }
		
		ta.focus();
        ta[0].selectionStart = ta.val().length - taPost;
        ta[0].selectionEnd = ta.val().length - taPost;
        
    });

	$('#reply_form #c_file').on('change', handleFileSelect)
		.on('mouseover', do_imgpreview_popup)
        .on('mouseout', del_popup)
        .on('click', function() {
           $('#hidbord_popup').remove();
        });

    $('#reply_form #post_preview_link').on('click', function(){
    	$('#reply_form #post_preview').show();
    	$('#reply_form #reply_text').hide();
    	$('#reply_form #post_preview').empty().append(markup.wkbmrk($('#reply_form #reply_text').val()).msg).show();
    });

    $('#reply_form #post_edit_link').on('click', function(){
    	$('#reply_form #post_preview').hide();
    	$('#reply_form #reply_text').show();
    });

    if(this.showThread == '0'){
    	this.app.db.getBoardPages(this.showSub)
    	.then(function(val){
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
    	}, fileData = null;

    	if (selectedFile.path){
			fileData = fs.readFileSync(selectedFile.path);
			message.filename = selectedFile.name;
			message.fileIsImage = selectedFile.isImage;
    	}

    	var packed = msgcrypt.encodeMessage(message, fileData, [this.showSub], null);
    	if(packed.length > 2*1024*1024 - 15){
    		window.alert('Message is to large! Size must be less than 2MB.');
			return false;
    	}

    	var hash = crpt.createHash('sha256').update(packed).digest();

    	fs.writeFile(opt.datadir + '/temp_msg/' + hash.toString('hex'), packed);
    	if(fileData){
    		fs.writeFileSync(opt.datadir + '/files/' + hash.toString('hex'), fileData);
    	}
		
		this.app.db.bumpThread(message.parent, message.timestamp);
		
		var postData = {
      		"id": hash.toString('hex'), 
      		"parent":  message.parent, 
      		"posted_at": message.timestamp, 
      		"bumped":  message.timestamp, 
      		"message": message.text,
      		"sent_to": this.showSub,
      		"state": 'sending',
      		"file": '',
      		"file_size": 0,
      		"file_ext": 'none'
      	};

      	if(fileData){
    		postData.file = selectedFile.name;
    		postData.file_size = selectedFile.size;
    		postData.file_ext = selectedFile.isImage ? 'image' : 'file';
    	}

		this.app.db.addPost(postData, function(){
      		this.showPage = 0;
			this.posts = [];

			this.renderPage();
      	}.bind(this));

      	this.app.ds.insertFile(packed);

    }.bind(this));

    this.posts = {};
	this.postsIds = [];
	this.postsRefs = {};

    if(this.showThread !== 0){
	    this.app.db.getBoardThreads(this.showSub, this.showThread, this.showPage, function(rows, board){
			if(board != this.showSub){
				return false;
			}
			$('#thread_render').empty().append('<hr>');
			
			if(this.showThread !== 0 && rows.length === 0){
				this.showThread = 0;
				this.showPage = 0;
				this.renderPage();
				return false;
			}

			for (var i = 0; i < rows.length; i++) {
				$('#thread_render').append(this.renderMsg(rows[i]));
				this.postsIds.push(rows[i].id);
				this.posts[rows[i].id] = rows[i];
			}

			this.renderRefs($('#thread_render'), this.postsRefs);	
			this.bindEvents('#thread_render');		
		}.bind(this));
	}else{
		this.app.db.getPage(this.showSub, this.showPage, 10, 3)
		    .then(function(val){
		    	var i, j;

		    	$('#thread_render').empty();
		      	
		      	for (i = 0; i < val.length; i++) {
   		
		      		$('#thread_render').append('<hr>' + this.renderMsg(val[i]));
		      		this.postsIds.push(val[i].id);
					this.posts[val[i].id] = val[i];
		      		
		      		if(val[i].post_count > 3){
		      			$('#thread_render').append('<span style="margin-left: 100px;">' + (val[i].post_count - 3) + 
		      				' posts omitted.  [<a href="" class="thread_reply" data-id="'+val[i].id+'">Reply</a>]</span>');
		      		}else{
		      			$('#thread_render').append('<span style="margin-left: 100px;">[<a href="" class="thread_reply" data-id="'+val[i].id+'">Reply</a>]</span>');
		      		}

		      		for (j = 0; j < val[i].replies.length; j++) {
		      			$('#thread_render').append(this.renderMsg(val[i].replies[j]));
		      			this.postsIds.push(val[i].replies[j].id);
						this.posts[val[i].replies[j].id] = val[i].replies[j];
		      		}
		      	}
		      	this.renderRefs($('#thread_render'), this.postsRefs);	
		      	this.bindEvents('#thread_render');
		    }.bind(this), function(val){throw val;});
	}
};

Ui.prototype.renderMsg = function renderMsg(data) {
    var m = markup.wkbmrk(data.message),
    	fileblock = '';


    if(data.file_ext == 'image'){
		fileblock = '<div style="font-size: 11px;"><a href="javascrip:;" class="post_file_link" data-id="'+data.id+'" data-name="'+markup.safe_tags(data.file)+'">'+markup.safe_tags(data.file)+'</a> ' + bytesMagnitude(data.file_size) + '</div>' +
		  '<img src="data/files/'+data.id+'" class="post_img hidbord_clickable img_thumb_size" style="float: left; padding: 5px 15px 5px 5px;"/>';
    }
	
	if(data.file_ext == 'file'){
		fileblock = '<div style="font-size: 11px;"><a href="javascrip:;" class="post_file_link" data-id="'+data.id+'" data-name="'+markup.safe_tags(data.file)+'">'+markup.safe_tags(data.file)+'</a> ' + bytesMagnitude(data.file_size) + '</div>';
    }


    var html = //(data.parent == '0' ? '<hr>': '<br>')+
    	'<div><div class="panel panel-default'+ (data.parent == '0' ? ' op': ' reply') +
    	(data.state == 'sending' || data.state == 'placeholder' ? ' temp_msg' : '') +'" id="msg_' + data.id + '">'+
    	'	<div class="panel-heading">'+
    	'        <span class="idntcn2"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASBAMAAACk4JNkAAAAMFBMVEUDAwMYGBgoKCg3NzdHR0dZWVlnZ2d4eHiIiIiYmJivr6+7u7vHx8fY2Njo6Oj6+vqWnH1mAAAAlUlEQVQI12NgQABGqakhbopgZvz///8PghgC9UDWCwEQSzH3/1MBJqAygXkOewVMhRgYmBRWNJ9iDQGxDF6lvTESTgSyAoAa/r3fDFSXWHPu/58bTkC9Sczn/l93AOplCGKZ26LTwAhkqSq1MjMqgExmK6g5NY0BxGKarLshCeKYTM4HS0A0cxCbwQQHEKsskSEQLAUAMvIuCOWCTMQAAAAASUVORK5CYII=" title="Anonymous" alt="Anonymous" style="vertical-align: bottom;"></span>&nbsp;'+
    	'<strong>Anonymous</strong>'+
    	' <i style="color: #999;">(' + dateToStr(data.posted_at) + ') <span class="hidbord_mnu_reply hidbord_clickable" data-id="'+data.id+'">#'+data.id.substr(0, 8)+'</span></i>'+
    	(data.state == 'sending' ? ' (message is in send queue)': '') +
		(data.state == 'placeholder' ? ' (message is not recived. This is Placeholder)': '') +
    	'    </div>'+
    	'    <div class="panel-body">'+
    	'        <div>'+
    	fileblock+m.msg +
    	'<div id="reply_links" style="font-size: 11px;font-style: italic; margin-top: 5px;"></div>'+
    	'        </div>'+
    	'    </div>'+
    	'</div></div>';

	for (var j = 0; j < m.refs.length; j++) {
    	this.postsRefs[m.refs[j]] = this.postsRefs[m.refs[j]] || {};
    	this.postsRefs[m.refs[j]][data.id] = data.id;
    }    

    return html;
};

Ui.prototype.renderRefs = function renderRefs(el, data) {
	var r, l;

	for(r in data){
		el.find('#msg_' + r + ' #reply_links').empty();
		for(l in data[r]){
			el.find('#msg_' + r + ' #reply_links').append('<a href="javascript:;" data-id="' + l + '" class="hidbord_msglink">&gt;&gt;' + l.substr(0, 8) + '</a>');
		}
	}

    return true;
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
	var s = $(selector);
	
	s.find('a.thread_reply').on('click', function(e){
		e.preventDefault();
		e.stopPropagation();
		this.showThread = e.target.dataset.id;
		this.showPage = 0;
		this.posts = [];
		this.renderPage();			
	}.bind(this));

	s.find('a.hidbord_msglink').on('mouseover', function(e){
        var msgid = e.target.dataset.id;   
        msgPopupTimers[msgid] = setTimeout(function() {
            do_popup(e, this);
        }.bind(this), 200);

    }.bind(this)).on('mouseout', del_popup);


	s.find('img.img_thumb_size').on('click', function(e){
        $(e.target).toggleClass('img_thumb_size');   
    });

	s.find('a.post_file_link').on('click', function(e){
		e.preventDefault();
		e.stopPropagation();
		console.dir({name: e.target.dataset.name, id: e.target.dataset.id});
		$('#saveFileDialog').attr('nwsaveas', e.target.dataset.name);
		$('#saveFileDialog').attr('data-id', e.target.dataset.id);
        setTimeout(function(){$('#saveFileDialog').click();}, 150);   
    });

	s.find('span.hidbord_mnu_reply').on('click', function(e){
		e.preventDefault();
		e.stopPropagation();
		var id = e.target.dataset.id;
		$('#msg_' + id).after($('#reply_form'));

		$('#post_edit_link').click();
		var ta = $('#reply_form textarea');
		insertInto(ta[0], '>>'+id+'\n');
		ta.focus();

	}.bind(this))
		.on('mouseover', function(e) {            
            quotedText = markup.quoteSelection();
        });
};

var msgPopupTimers = {}, popup_del_timer;

function del_popup(e) {
    var msgid = e.target.dataset.id;
    clearTimeout(msgPopupTimers[msgid]);

    if(msgid == 'file_selector'){
        $('#file_selector').remove();
        return;
    }
    
    msgPopupTimers[msgid] = setTimeout(function() {
        if(msgid == 'msg_preview'){
            $('#prev_popup').remove();
        }else{
            $('#hidbord_popup_' + msgid).remove();
        }
    }, 200);
}

var do_popup = function(e, ui) {
	var msgid = e.target.dataset.id,
		bbox  = e.target.getBoundingClientRect(),
		css = {position: "fixed", 'z-index': 200, left: bbox.left + 'px'},
		wh = $(window).height(),
		ww = $(window).width();

	if(bbox.top > wh / 2){
		css.bottom = (wh - bbox.top) + 'px';
	}else{
		css.top = bbox.bottom + 'px';
	}

	$('body').append('<div id="hidbord_popup_' + msgid + '"></div>');
	if(msgid in ui.posts){
		$('#hidbord_popup_'+ msgid).css(css).append(ui.renderMsg(ui.posts[msgid]));
		$('#hidbord_popup_'+ msgid + ' .panel').css({margin: 0, 'box-shadow': '0 1px 10px rgba(0, 0, 0, 0.3)'});
		ui.renderRefs($('#hidbord_popup_' + msgid), ui.postsRefs);	
    	ui.bindEvents('#hidbord_popup_' + msgid);
	}else{
		ui.app.db.getPost(msgid).then(function(data){
			$('#hidbord_popup_'+ msgid).css(css).append(this.renderMsg(data));
			$('#hidbord_popup_'+ msgid + ' .panel').css({margin: 0, 'box-shadow': '0 1px 10px rgba(0, 0, 0, 0.3)'});
			this.renderRefs($('#hidbord_popup_' + msgid), ui.postsRefs);	
    		this.bindEvents('#hidbord_popup_' + msgid);
		}.bind(ui),function(err){
			$('#hidbord_popup_'+ msgid).css(css).append('<div style="padding: 10px; background: #fee; border: 1px solid #f00; font-weight: bold; text-align:center;">NOT FOUND</div>');	
		}.bind(ui));		
	}
	
	var local_popup_del_timer;

    $('#hidbord_popup_' + msgid).on('mouseover', function() {
        clearTimeout(local_popup_del_timer);
        clearTimeout(msgPopupTimers[msgid]);
    }).on('mouseout', function(){
        local_popup_del_timer = setTimeout(function() {
            $('#hidbord_popup_' + msgid).remove();
        }, 200);
    });
    
};

var bytesMagnitude = function(bytes){
    if(bytes < 1024){
        return bytes + ' B';
    }else if (bytes < 1024 * 1024){
        return (bytes / 1024).toFixed(2) + ' KB';
    }else{
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }
};


var do_imgpreview_popup = function(e) {
    $('#file_selector').remove();
    if (!selectedFile.path) return;

    var txt = '<div style="box-shadow: 0 0 10px #555; background: #fafafa; padding: 5px;"><p style="text-align: center;">'+
              (selectedFile.isImage ? '<img style="max-width: 200px; max-height: 200px;" src="' + selectedFile.path + '"><br>': '')+
               markup.safe_tags(selectedFile.name) + '<br>'+bytesMagnitude(selectedFile.size)+'</p>'+
              '</div>',
        bbox  = e.target.getBoundingClientRect(),
		css = {position: "fixed", 'z-index': 200, left: bbox.left + 'px'},
		wh = $(window).height(),
		ww = $(window).width();

	
	if(bbox.top > wh / 2){
		css.bottom = (wh - bbox.top + 5) + 'px';
	}else{
		css.top = (bbox.bottom + 5) + 'px';
	}

    $('body').append('<div class="hidbord_popup" id="file_selector"></div');
    $('#file_selector').append(txt).css(css);


    $('#file_selector .hidbord_msg').on('mouseover', function() {
        clearTimeout(popup_del_timer);
    }).on('mouseout', del_popup);

};


var insertInto = function(textarea, text) {
    if (quotedText.length > 0 && quotedText != '> \n'){
        text += quotedText;
    }

    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    textarea.value = textarea.value.substr(0, start) + text + textarea.value.substr(end);
    textarea.setSelectionRange(start + text.length, start + text.length);
};

var selectedFile = {};

function handleFileSelect(evt) {

	if(evt.target.files.length === 0){
		evt.target.value = null;
		selectedFile = {};
		return false;
	}

    var files = evt.target.files[0]; // FileList object
    if(files.size > 2096128){
		selectedFile = {};
		evt.target.value = null;
		window.alert('File is to large! Size must be less than 2MB.');
		return false;
    }

    selectedFile.name = files.name;
    selectedFile.size = files.size;
    selectedFile.path = files.path;
    selectedFile.isImage = !!files.type.match('image.*');
    console.dir(files);
    
}
module.exports = Ui;
