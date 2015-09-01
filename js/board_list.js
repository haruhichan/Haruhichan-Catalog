(function() {
	"use strict";
	
	var BoardList = {
		settings: {'menu': ''},
		boardExclusiveList: [],
		
		init: function() {
			chrome.runtime.onMessage.addListener(BoardList.messageListener);
			
			$(document).ready(function() {
				BoardList.reloadBoardList();
			});
		},
		
		reloadBoardList: function() {
			var board_list_sm = $('#board_list_sm');
			var board_list = $('#board_list');
			var sm = (board_list_sm.length) ? board_list_sm : board_list;
			
			sm.empty();
			sm
				.append($("<img>", {src: 'img/loading.gif'}))
				.append($("<br />"))
				.append($("<br />"))
				.append("Downloading board list from api.4chan.org...");
			
			chrome.storage.local.get(BoardList.settings, function(items) {
				if(typeof(items.menu) != 'undefined') {
					BoardList.settings = items;
					
					// Test for empty or whitespace only (in case some retard only enters a single space, or some other weird thing)
					if(items.menu != '' && /\S/.test(items.menu) == true) {
						BoardList.boardExclusiveList = items.menu.split(' ');
					} else {
						BoardList.boardExclusiveList = [];
					}
				}
				
				$.getJSON('https://a.4cdn.org/boards.json', function(data) {
					data.boards.sort(function (a, b) { return a.title.localeCompare(b.title); });

					sm.empty();
					
					var ul = $("<ul>", {id: 'topnav', class: 'front'});
					
					for(var i = 0; i < data.boards.length; i++) {
						if(BoardList.isBoardExcluded(data.boards[i].board) == false) {
							var buttonClass = (board_list_sm.length) ? 'button boardBtnSm' : 'button boardBtn';
							var link = $("<a>", {class: buttonClass, href: 'board.html?board=' + data.boards[i].board + '&desc=' + encodeURIComponent(data.boards[i].title)});
							var li = $("<li>");
						
							link
								.append(data.boards[i].title + " (")
								.append($("<font>", {class: 'boardDir', text: '/' + data.boards[i].board + '/'}))
								.append(")");
						
							li.append(link);
							ul.append(li).append("\r\n");
						}
					}
					
					sm.append(ul);
				});
			});
		},
		
		messageListener: function(request, sender, sendResponse) {
			console.log(request.event);
			
			if(typeof(request.event) !== 'undefined') {
				if(request.event == 'updateBoardList') {
					BoardList.reloadBoardList();
				}
			}
		},
		
		isBoardExcluded: function(board) {
			if(BoardList.boardExclusiveList.length == 0) return false;
			
			return BoardList.boardExclusiveList.indexOf(board) == -1;
		}
	};
	
	BoardList.init();
})();