angular.module('Tools', [])
.service('dictionary', function($q, $http)
{
	var _dictionary = {};
	var _this = this;
	var _loader = $q.defer();

	_this.lang = "en";

	_this.get = function(term, index)
	{
		if (index === undefined)
		{
			return (_dictionary[_this.lang] && _dictionary[_this.lang][term]) || term;
		}
		if (_dictionary[_this.lang] && _dictionary[_this.lang][term])
		{
			return _dictionary[_this.lang][term][index] || (term + index);
		}
		return term + index;
	};

	_this.getLanguages = function()
	{
		var list = {};
		var count = 0;

		for (var lang in _dictionary)
		{
			list[lang] = _dictionary[lang]['lang'];
			++count;
		}

		if (count > 1)
		{
			return list;
		}
		return {};
	};

	_this.loader = _loader.promise;
	
	$http.get('dictionary.json')
		.then(
			function(response)
			{
				_dictionary = response.data;
				_loader.resolve();
			},
			function(response)
			{
				throw 'Failed to load dictionary';
			}
		);
})
.factory('showDialog', function($compile, dictionary)
{
	var _dialog = [];
	var _dialogMask = [];
	var _dialogIndex = -1;

	return function(message, buttons, template)
	{
		++_dialogIndex;

		var _this = this;

		document.body.style.overflow = 'hidden';

		if (!_dialog[_dialogIndex])
		{
			_dialog[_dialogIndex] = $('<div class="dialog level' + (_dialogIndex % 3) + ' ng-hide" data-ng-controller="DialogController"><span class="message"></span><p></p><div class="buttons"></div></div>');
			_dialogMask[_dialogIndex] = $('<div class="dialogMask level' + (_dialogIndex % 3) + ' ng-hide"></div>');
			$(document.body)
				.append(_dialog[_dialogIndex])
				.append(_dialogMask[_dialogIndex]);
		}

		var messageText;
		
		if (angular.isArray(messageText))
		{
			messageText = dictionary.get(message[0]);

			for (var i = 1; i < message.length; i++)
			{
				messageText = messageText.replace(message[i].key, dictionary.get(message[i].message, message[i].index));
			}
		}
		else
		{
			messageText = dictionary.get(message);
		}

		var dialog = _dialog[_dialogIndex];
		var dialogMask = _dialogMask[_dialogIndex];
		var dialogElements = dialog.find('p');
		var dialogButtons = dialog.find('div');
		var templateElements = {};
		var firstElement;
		
		dialog.find('span').text(messageText);
		dialogElements.empty();
		dialogButtons.empty();

		if (template)
		{
			for (var i = 0; i < template.length; i++)
			{
				var item = template[i];
				var element = $('<span></span>');

				element.attr('class', item.class);

				switch (item.type)
				{
					case 'text':
					{
						element.text(dictionary.get(item.text));
						break;
					}
					case 'html':
					{
						element.html(item.html);
						break;
					}
					case 'input':
					case 'email':
					case 'number':
					case 'range':
					case 'search':
					{
						var input = $('<input/>');

						input.attr('type', item.type === 'input' ? 'text' : item.type);
						input.attr('placeholder', dictionary.get(item.placeholder));
						input.attr('maxlength', item.maxlength);
						input.attr('min', item.min);
						input.attr('max', item.max);
						input.attr('step', item.step);

						if (input.onchange)
						{
							input.bind('change', input.onchange);
						}

						templateElements[item.name] = input;
						
						if (!firstElement)
						{
							firstElement = input;
						}

						element.append(input);
						break;
					}
				}

				dialogElements.append(element);
			}
		}

		if (buttons)
		{
			for (var i = 0; i < buttons.length; i++)
			{
				var button = buttons[i];

				var element = $('<button></button>');				

				element.text(dictionary.get(button.text, button.index));
				element[0].clickEvent = button.click; 
				element.on(
					"click",
					function()
					{
						if (this.clickEvent) 
						{
							var returnValue = this.clickEvent(templateElements);

							if (returnValue)
							{
								if (returnValue.then)
								{
									returnValue.then(function()
										{
											CloseDialog();
										});
								}
								return;
							}
						}
						CloseDialog();
					}
				);

				dialogButtons.append(element);
			}
		}
		else
		{
			dialogButtons.append(
				$('<button></button>')
					.text(dictionary.get('close'))
					.on(
						'click',
						function()
						{
							CloseDialog();
						}
					)
			);
		}

		dialogMask
			.css({ 'z-index': 1000 + 2 * _dialogIndex })
			.toggleClass('ng-hide', false);
		dialog
			.css({ 'z-index': 1000 + 2 * _dialogIndex + 1 })
			.toggleClass('ng-hide', false);

		if (firstElement)
		{
			firstElement[0].focus();
		}

		return CloseDialog;

		function CloseDialog()
		{
			_dialog[_dialogIndex].toggleClass('ng-hide', true);			
			_dialogMask[_dialogIndex].toggleClass('ng-hide', true);
			--_dialogIndex;

			if (_dialogIndex === -1)
			{
				document.body.style.overflow = '';
			}
		}
	};
})
.service('webSocket', function($q, showDialog)
{
	if (!WebSocket)
	{
		return;
	}

	this.ok = true;

	var _this = this;
	var _webSocket = new WebSocket('ws://' + window.location.host);
	var _request = {};
	var _loader = $q.defer();
	var _listeners = {}; 

	_this.loader = _loader.promise;

	_webSocket.onmessage = function(messageEvent)
	{
		try
		{
			var response = JSON.parse(messageEvent.data);
console.log(response)
			if (response.status === 'error') 
			{
				showDialog(response.data);
				deferred.reject();
				return;
			}

			localStorage.setItem('userId', response.userId)

			for (var key in _listeners)
			{
				if (key === response.requestId)
				{
					_listeners[key](response.data);
					return;
				}
			}

			var deferred = _request[response.requestId];

			deferred.resolve(response.data);
		}
		catch (err)
		{
			console.log(err);
			showDialog('unknown-error');
		}
	};

	_webSocket.onopen = function()
	{
		_loader.resolve();
	}

	_webSocket.onclose = function()
	{
		showDialog('websocket-closed');
	}

	_this.addListener = function(key, callback)
	{
		_listeners[key] = callback;
	};

	_this.getData = function(action, data)
	{
		var message = {
			requestId: Math.random().toString().substr(2),
			action: action
		};
		if (localStorage.userId)
		{
			message.userId = localStorage.userId;
		}
		if (data)
		{
			message.data = data;
		}
			
		var deferred = _request[message.requestId] = $q.defer();		

		if (_webSocket.readyState === 1)
		{
			_webSocket.send(JSON.stringify(message));
		}
		else
		{
			deferred.reject();
		}

		return deferred.promise;
	};	
})
.directive('unselectable', function()
{
	return {
		restrict: 'A',
		link: function($scope, $element)
		{
			var element = $element[0];
			element.onselectstart = function() { return false; };
			element.style.MozUserSelect = "none";
			element.style.KhtmlUserSelect = "none";
			element.unselectable = "on";
		}
	};
})
.directive('dicText', function($q, dictionary)
{
	return {
		restrict: 'A',
		link: function(scope, element, attributes)
		{
			dictionary.loader.then(function()
			{
				element.html(dictionary.get(attributes.dicText, attributes.dicIndex));
			});
		}
	}
})
.directive('dicTitle', function($q, dictionary)
{
	return {
		restrict: 'A',
		link: function(scope, element, attributes)
		{
			dictionary.loader.then(function()
			{
				element.attr('title', dictionary.get(attributes.dicTitle, attributes.dicIndex));
			});
		}
	}
});