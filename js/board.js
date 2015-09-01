(function() {
	"use strict";
	
	var Board = {
		tabsUrl: null,
		current: null,
		curdesc: null,
		catalog: null,
		settings: {
			'magnify': false,
			'nobinds': true,
			'nospoiler': false,
			'replies': true,
			'stickies': true,
			'autogif': true,
			'autowebm': true,
			'resamplewebm': false,
			'archives': true,
			'linkifier': true,
			'menu': ''
		},
		keysDown: [],
		stickyQueue: [],
		gifLoadQueue: [],
		
		init: function() {
			chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
				Board.tabsUrl = tabs[0].url;
				Board.current = Board.getURLParameter('board');
				Board.curdesc = Board.getURLParameter('desc');
				$('#slogan').text('/' + Board.getURLParameter('board') + '/ - ' + Board.getURLParameter('desc'));
				
				$.getJSON(chrome.extension.getURL('json/archives.json'), function(data) {
					Board.catalog = data;
					Board.refreshCatalogThreads();
				});
			});
			
			chrome.runtime.onMessage.addListener(Board.messageListener);
			
			$('#footerText').html('Running <a href="http://haruhichan.com" target="_blank">Haruhichan Catalog</a> v' + chrome.app.getDetails().version + 
				' - All data pulled from <a href="http://api.4chan.org" target="_blank">api.4chan.org</a>');
				
			$('#refreshButton').click(function() {
				Board.refreshCatalogThreads();
			});
			
			$('#optionsButton').click(function() {
				$('#theme').css('display', 'block');
			});
			
			$('#theme-save').click(function() {
				Board.saveSettings();
			});
			
			$('#theme-close').click(function() {
				$('#theme').css('display', 'none');
			});
			
			Board.loadSettings();
			
			$('.clickbox').click(function() {
				var key = $(this).attr('id').split('-')[1];
				var newValue = !$(this).hasClass('active');
				
				Board.switchCheckboxAttribute($(this), newValue);
				Board.settings[key] = newValue; // WE NEED TO CHANGE THE VALUE HOLY FUCK HOW STUPID ARE YOU EVEN WHAT THE FUCK
			});
		},
		
		messageListener: function(request, sender, sendResponse) {
			console.log(request.event);
		},
		
		dispatchSimpleMessage: function(msg) {
			chrome.tabs.query({}, function(tabs) {
				for (var i = 0; i < tabs.length; i++) {
					chrome.tabs.sendMessage(tabs[i].id, {event: msg});
				}
			});
		},
		
		loadSettings: function() {
			chrome.storage.local.get(Board.settings, function(items) {
				Board.settings = items;
				
				for(var key in Board.settings) {
					if(typeof(Board.settings[key]) == 'boolean') {
						Board.switchCheckboxAttribute($('#theme-' + key), Board.settings[key]);
					} else if(typeof(Board.settings[key]) == 'string') {
						$('#theme-' + key).val(Board.settings[key]);
					}
				}
			});
		},
		
		saveSettings: function() {
			var oldMenuOptions = Board.settings['menu'];
			
			if(oldMenuOptions != $('#theme-menu').val()) {
				Board.settings['menu'] = $('#theme-menu').val();
				
				// Refresh Board Options... Yes
				Board.dispatchSimpleMessage('updateBoardList');
			}
		
			chrome.storage.local.set(Board.settings, function() {
				$('#theme-msg').html("Done").attr("class", "msg-ok").show().delay(500).fadeOut(500);
				
				Board.applySettings();
			});
		},
		
		// This is for immediate stuff that needs to be applied when saving
		applySettings: function() {
			Board.dispatchSimpleMessage('applySettings');
		},
		
		switchCheckboxAttribute: function(obj, active) {
			if(active){ 
				obj.addClass('active');
				obj.html("&#x2714;");
			} else {
				obj.removeClass('active');
				obj.html('');
			}
		},
		
		getURLParameter: function(name) {
			return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(Board.tabsUrl)||[,""])[1].replace(/\+/g, '%20'))||null;
		},
		
		getThumbnailUrl: function(data) {
			if(Board.current == 'f') {
				return "http://static.neet.tv/f/src/" + data.no + ".jpg";
			}
		
			if(typeof(data.tim) == 'undefined' || data.filedeleted == 1 || (data.tn_w < 10 && data.tn_h < 10)) {
				return 'https://s.4cdn.org/image/filedeleted.gif';
			}
			
			if(data.spoiler == 1) {
				if(typeof(data.custom_spoiler) != 'undefined' && data.custom_spoiler > 0) {
					return "https://s.4cdn.org/image/spoiler-" + Board.current + data.custom_spoiler + ".png";
				} else {
					return "https://s.4cdn.org/image/spoiler.png";
				}
			}

			return "https://t.4cdn.org/" + Board.current + "/" + data.tim + "s.jpg";
		},

		getThreadUrlEx: function(useBoard, id) {
			return "https://boards.4chan.org/" + useBoard + "/thread/" + id;
		},

		getThreadUrl: function(data) {
			if(Board.current == 'f') {
				return Board.getThreadUrlEx(Board.current, data.no);
			}
			
			return "https://boards.4chan.org/" + Board.current + "/thread/" + data.no + "/" + data.semantic_url;
		},

		filterTeaserLinkContent: function(data) {
			var exp = /\b((https?|ftps?|about|bitcoin|git|irc[s6]?):(\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/|magnet:\?(dn|x[lts]|as|kt|mt|tr)=)([^\s()<>]+|\([^\s()<>]+\))+(\([^\s()<>]+\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])/g;
			
			var nodes = data[0].childNodes;
			
			for(var i = 0; i < nodes.length; i++) {
				var n = nodes[i];
				
				if(n.nodeType == n.TEXT_NODE || n.nodeName == 'BR') {
					var g = n.textContent.match(exp);
					
					while(g) {
						var idx=n.textContent.indexOf(g[0]);
						var pre=n.textContent.substring(0,idx);
						var a=document.createElement("a");

						if (!/^[a-z][\w-]+:/.test(g[0])) {
							a.href = "http://" + g[0];
						} else {
							a.href = g[0];
						}
						
						a.innerText = g[0];
						n.textContent = n.textContent.substring(idx+g[0].length);
						n.parentElement.insertBefore(a,n);
						g=n.textContent.match(exp);
					}
				} else {
					Board.filterTeaserLinkContent($(n));
				}
			}
		},
		
		filterTeaserContent: function(data) {
			// Jam into <div> so we can play with it
			var c = $('<div>' + data + '</div>');

			// Remove <wbr> tag which breaks links
			c.find('wbr').each(function() {
				$(this).remove();
			});
			
			// Re-parse the HTML after removing <wbr> or else the text nodes won't be joined
			c = $('<div>' + c.html() + '</div>');
			
			// I actually forget what this does, but fuck it. Shit.
			c.not("div, s, span, a").each(function() {
				var content = $(this).contents();
				$(this).replaceWith(content);
			});
			
			c.find('span').each(function() {
				$(this).removeAttr('style'); // I'm not sure if this is a good idea...
			});
			
			c.find('font').each(function() {
				$(this).removeAttr('size');
			});
			
			if(Board.settings['linkifier'] == true) {
				Board.filterTeaserLinkContent(c);	
			}
			
			// Remove images in post preview because they don't need to be here...
			c.find('img').each(function() {
				$(this).remove();
			});
			
			// Simplify line breaks
			return c.html().replace(/<br ?\/?><br ?\/?>/g, "<br>");
		},

		getLinkDataArray: function(txt) {
			if(txt.substring(0, 3).localeCompare('>>>') == 0) {
				var dat = txt.substring(3);
				var spl = dat.split('/');
				
				if(!isNaN(spl[2]) && spl[2].length > 0) { // We have a numeric thingy
					return {'board':spl[1], 'id':spl[2]};
				} else {
					return {'direct':dat};
				}
			} else if(txt.substring(0, 2).localeCompare('>>') == 0 && !isNaN(txt.substring(2))) {
				return {'board':Board.current, 'id':txt.substring(2)};
			}
		},

		formQuoteLink: function(txt) {
			var linkData = Board.getLinkDataArray(txt);
			
			if(typeof(linkData) != 'undefined' && typeof(linkData.id) != 'undefined') {
				return Board.getThreadUrlEx(linkData.board, linkData.id);
			} else if(typeof(linkData) != 'undefined' && typeof(linkData.direct) != 'undefined') {
				return 'https://boards.4chan.org' + linkData.direct;
			}
			
			console.log('Resolve Link Failure: "' + txt + '"');
		},
		
		postProcessing: function() {
			// EXIF stuff
			$(".abbr a[href='javascript:void(0)']").each(function(index) {
				var onclickCode = $(this).attr('onclick');
				onclickCode = onclickCode.match(/toggle\(\'(.+?)\'\)/);
				onclickCode = onclickCode[1];
				$(this).removeAttr('onclick');
				$(this).removeAttr('href');
				$(this).css('cursor', 'pointer');
				$(this).css('-webkit-user-select', 'none');
				
				$(this).qtip({
					//prerender: true,
					content: {
						text: $('#' + onclickCode).html(),
						title: 'EXIF Data'
					},
					style: {
						def: false,
						classes: 'qtip-exif qtip-shadow'
					},
					show: { event: 'click' },
					position: {
						collision: 'flip',
						viewport: $(window)
					}
				});
			});
		},
		
		refreshCatalogThreads: function() {
			var thread_list = $('#thread_list');
			
			thread_list.empty();
			
			thread_list
				.append($("<img>", {src: 'img/loading.gif'}))
				.append($("<br />"))
				.append($("<br />"))
				.append($("<div>", {class: 'loadingtext', text: "Loading board catalog..."}));
			
			$.getJSON('https://a.4cdn.org/' + Board.current + '/catalog.json', function(data) {
				// We only want to loop through this once
				var standardPages = [];
				var stickyPages = [];
				var officialStickyPages = [];
				var filterPages = [];
				
				//
				for(var i = 0; i < data.length; i++) {
					var pageNumber = data[i].page;
					
					for(var t = 0; t < data[i].threads.length; t++) {
						data[i].threads[t].page = pageNumber;
						
						if(data[i].threads[t].sticky == 1 && Board.settings['stickies'] == true) {
							officialStickyPages.push(data[i].threads[t]);
							continue;
						}
						
						var teaser = (typeof(data[i].threads[t].com) != 'undefined') ? data[i].threads[t].com : '';
						var subject = (typeof(data[i].threads[t].sub) != 'undefined') ? data[i].threads[t].sub : '';

						//if(doesMatchFilterData(teaser) || doesMatchFilterData(subject)) {
						if(false) {
							stickyPages.push(data[i].threads[t]);
						} else {
							standardPages.push(data[i].threads[t]);
						}
					}
				}

				thread_list.empty();
				
				Board.publishArray(thread_list, officialStickyPages, false);
				Board.publishArray(thread_list, stickyPages, true);
				Board.publishArray(thread_list, standardPages, false);
				
				Board.postProcessing();
			});
		},
		
		publishArray: function(p, a, stickyFilter) {
			for(var t = 0; t < a.length; t++) {
				var thread = a[t];
				p.append(Board.constructArticle(thread, a[t].page, stickyFilter));
			}
	
			return p;
		},
		
		constructMetaData: function(sticky, pagenum, p) {
			var h = $("<div>", {id: "meta-" + p.no, class: "meta" + ((p.bumplimit == 1) ? " limited" : "")});
			
			if(p.bumplimit == 1 && sticky == 0) {
				h.append("(R: <u>BUMP LIMIT</u>)");
			} else {
				if(p.replies) {
					h.append("(R: " + p.replies + ")");
				}
			}
			
			if(p.images) {
				h.append(" (I: " + p.images + ")");
			}
			
			if(pagenum) {
				h.append(" (P: " + pagenum.toString() + ")");
			}
			
			return h;
		},
		
		fillCanvasWithVideoElement: function(canvasElement, videoElement, tempElement, tw, th, w, h) {
			var ctx = canvasElement[0].getContext('2d');
			var tpx = tempElement[0].getContext('2d');
				
			tempElement[0].width = w * 0.5;
			tempElement[0].height = h * 0.5;
				
			tpx.drawImage(videoElement[0], 0, 0, tempElement[0].width, tempElement[0].height);
			tpx.drawImage(tempElement[0], 0, 0, tempElement[0].width * 0.5, tempElement[0].height * 0.5);
				
			ctx.drawImage(tempElement[0], 0, 0, tempElement[0].width * 0.5, tempElement[0].height * 0.5, 0, 0, tw * 2.0, th * 2.0);
			
			setTimeout(Board.fillCanvasWithVideoElement, 10, canvasElement, videoElement, tempElement, tw, th, w, h);
		},
		
		constructReplacementElement: function(data, imgElement) {
			if(Board.current != 'gif' && Board.current != 'wsg' && Board.settings['autogif'] == true) {
				if(data.ext == '.gif') {
					imgElement.attr('src', "https://i.4cdn.org/" + Board.current + "/" + data.tim + data.ext);
				} else if(data.ext == '.webm' && Board.settings['autowebm'] == true) {
					var iw = imgElement.width();
					var ih = imgElement.height();
					
					if(Board.settings['resamplewebm'] == true) {	
						var webmElement = $("<video>", {width: data.w, height: data.h, src: 'https://i.4cdn.org/' + Board.current + "/" + data.tim + data.ext});
						var canvElement = $("<canvas>", {width: iw, height: ih, class: ((data.spoiler == 1) ? "spoiler_thumb" : "thumb")});
						var tempElement = $("<canvas>");
						
						webmElement.css('visibility', 'hidden');
						webmElement.attr('loop', '');
						webmElement[0].play();
							
						imgElement.replaceWith(canvElement);
						
						console.log("Drawing Canvas (" + iw + ", " + ih + ", " + data.w + ", " + data.h + ")");
						
						Board.fillCanvasWithVideoElement(canvElement, webmElement, tempElement, iw, ih, data.w, data.h);
					} else {
						var webmElement = $("<video>", {width: iw, height: ih, src: 'https://i.4cdn.org/' + Board.current + "/" + data.tim + data.ext, class: ((data.spoiler == 1) ? "spoiler_thumb" : "thumb")});
						
						webmElement.attr('loop', '');
						webmElement[0].play();
						
						imgElement.replaceWith(webmElement);
					}
				}
			}
		},
		
		constructSpoilerHover: function(p, imgElement) {
			if(p.spoiler == 1) {
				imgElement.attr('data-spi', Board.getThumbnailUrl(p));
				
				p.spoiler = 0;
				imgElement.attr('data-hover', Board.getThumbnailUrl(p));
				p.spoiler = 1;
				
				imgElement.hover(function(e) {
					// In
					$(this).attr('src', $(this).attr('data-hover'));
				}, function(e) {
					// Out
					$(this).attr('src', $(this).attr('data-spi'));
				});
			}
		},
		
		constructArticle: function(p, pagenum, isStickyFilter) {
			var teaser = (typeof(p.com) != 'undefined') ? p.com : '';
			var sticky = (typeof(p.sticky) != 'undefined') ? p.sticky : 0;
			
			var articleClass = 'thread' + ((sticky) ? " sticky" : "") + ((p.closed) ? " closed" : "") + ((p.bumplimit == 1 && sticky == 0) ? " bumplimit" : "") + ((isStickyFilter == 1) ? " stickyFilter" : "");
			var article = $("<article>", {id: 'thread-' + p.no, class: articleClass});
			
			// Clickable thumbnail + gif autoloading + webm autoloading
			var thumbnail_class = "thumb";
			
			if(p.spoiler == 1) {
				thumbnail_class = "thumb spoiler_thumb";
			}
			
			if(typeof(p.tim) == 'undefined' || p.filedeleted == 1 || (p.tn_w < 10 && p.tn_h < 10) && Board.current != 'f') {
				thumbnail_class = "thumb deleted_thumb";
			}
			
			// it seems /f/ needs some special care or something, neet catalog generates thumbnails (we could steal this functionality, but meh)
			var imgElement = $("<img>", {alt:'', id: "thumb-" + p.no, class: thumbnail_class, src: Board.getThumbnailUrl(p)})
			.load(function() {
				Board.constructReplacementElement(p, $(this));
			})
			.bind('error', function() {
				if(Board.current == 'f') {
					$(this).attr('src', 'http://static.neet.tv/images/thumb-404.png');
				}
			});
			
			// One issue with this is when the image resizes it changes size completely
			// It does not conform to spoiler width
			// Might be removed in final...
			// Board.constructSpoilerHover(p, imgElement);
			
			article
				.append($("<a>", {style: 'border-bottom:0;', alt:'', target: '_blank', href: Board.getThreadUrl(p)})
				.append(imgElement));
			
			// Bump Limit + Replies + Images + Page Number
			article
				.append(Board.constructMetaData(sticky, pagenum, p));
					
			// Sticky Icon
			if(sticky) {
				article
					.append($("<div>", {class: 'stickyimg'}).append($("<img>", {src: 'https://s.4cdn.org/image/sticky.gif', alt: 'Sticky'})));
			}
			
			// Closed Icon
			if(p.closed) { 
				article
					.append($("<div>", {class: 'closedimg'}).append($("<img>", {src: 'https://s.4cdn.org/image/closed.gif', alt: 'Closed'})));
			}
			
			if(typeof(p.country) != 'undefined' && p.country.length > 0) {
				if(Board.current == 'pol') {
					article
						.append($("<div>", {class: 'flagimg'}).append($("<img>", {src: 'https://s.4cdn.org/image/country/troll/' + p.country.toLowerCase() + '.gif', alt: 'Flag'})));
				} else {
					article
						.append($("<div>", {class: 'flagimg'}).append($("<img>", {src: 'https://s.4cdn.org/image/country/' + p.country.toLowerCase() + '.gif', alt: 'Flag'})));
				}
			}
			
			// Subject (if it exists)
			if(Board.current == 'f') {
				article.append($("<div>", {class: 'subject', html: "[" + p.tag + "] " + p.filename}));
				
				var teaserFlash = '';
				var teaserContent = Board.filterTeaserContent(teaser);
				
				if(typeof(p.sub) != 'undefined') {
					teaserFlash += p.sub;
					
					if(teaserContent.length > 0) {
						teaserFlash += ': ';
					}
				}
				
				teaserFlash += teaserContent;
				
				// Teaser (OP post preview)
				article
					.append($("<div>", {class: 'teaser', html: teaserFlash}));
			} else {
				if(typeof(p.sub) != 'undefined') {
					article
						.append($("<div>", {class: 'subject', html: p.sub}));
				}
				
				// Teaser (OP post preview)
				article
					.append($("<div>", {class: 'teaser', html: Board.filterTeaserContent(teaser)}));
			}
			
			// Make links open in a new tab
			article.find("a[class!='quotelink']").each(function(i) {
				$(this).attr('target', '_blank');
			});
			
			// Fix quote links (cross-board links and direct links)
			article.find('.quotelink').each(function(i) {
				$(this).attr('href', Board.formQuoteLink($(this).text()));
				$(this).attr('target', '_blank');
			});
			
			// Fix dead links (archive or no archive)
			if(Board.settings['archives'] == true) {
				article.find('.deadlink').each(function(i) {
					var linkData = Board.getLinkDataArray($(this).text());
					
					if(typeof(linkData) != 'undefined' && typeof(linkData.id) != 'undefined') {
						for(var i = 0; i < Board.catalog.length; i++) {
							var catalogInfo = Board.catalog[i];
							
							if(catalogInfo.boards.indexOf(linkData.board) != -1) {
								var cataUrl = ((catalogInfo.https) ? 'https' : 'http') + '://' + catalogInfo.domain + '/' + linkData.board + '/thread/' + linkData.id;
								
								if(catalogInfo.software == 'foolfuuka') {
									cataUrl = cataUrl + '/';
								}
								
								if(linkData.board == Board.current) {
									$(this).before($("<a>", {href: cataUrl, class: 'archivelink', target: '_blank', text: '>>Archive (' + linkData.id + ')'}));
								} else {
									$(this).before($("<a>", {href: cataUrl, class: 'archivelink', target: '_blank', text: '>>Archive (/' + linkData.board + '/' + linkData.id + ')'}));
								}
								
								$(this).remove();
							}
						}
					}
				});
			}
			
			// Highlight public bans for lols
			article.find('b, strong').each(function(i) {
				var v = $(this).text();
				if(v == '(USER WAS BANNED FOR THIS POST)') {
					$(this).css('color', 'rgb(238, 170, 170)');
					$(this).css('text-shadow', '0 1px 2px #000');
				}
			});
			
			return article;
		}
	};
	
	$(document).ready(function() {
		Board.init();
	});
})();