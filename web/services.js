angular.module('Tools', [])
.service('dictionary', function($q, $http)
{
	var _service = this;
	var _dictionary = {};
	var _loader = $q.defer();

	_service.lang = null;

	_service.get = function(term, index)
	{
		if (index === undefined)
		{
			return (_dictionary[_service.lang] && _dictionary[_service.lang][term]) || term;
		}
		if (_dictionary[_service.lang] && _dictionary[_service.lang][term])
		{
			return _dictionary[_service.lang][term][index] || (term + index);
		}
		return term + index;
	};

	_service.getLanguages = function()
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

	_service.loader = _loader.promise;
	
	$http.get('dictionary.json')
		.then(
			function(response)
			{
				_dictionary = response.data;

				for (var lang in window.navigator.languages)
				{
					if (_dictionary[lang])
					{
						_service.lang = lang;
						break;
					}
					if (lang.length === 5 && _dictionary[lang.substr(0, 2)])
					{
						_service.lang = lang.substr(0, 2);
						break;
					}
				}

				if (_service.lang === null)
				{
					_service.lang = Object.keys(_dictionary)[0];
				}

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

		var _service = this;

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
.service('cookie', function()
{
	this.read = function(name)
	{
		var cookies = document.cookie.split('; ');
		var match = escape(name) + '=';

		for (var cookie in cookies)
		{
			if (cookie.substr(0, match.length) === match)
			{
				return unescape(cookie.substr(match.length));
			}
		}
	};

	this.write = function(name, value, maxAge)
	{
		document.cookie = escape(name) + '=' + escape(value) + (maxAge ? '; max-age=' + parseInt(maxAge): '');
	}

	this.delete = function(name)
	{
		document.cookie = escape(name) + '=; max-age=-1';
	}
})
.service('http', function($http, $q, cookie, showDialog)
{
	var _service = this;
	var _buffer = {};

	_service.fetch = function(action, parameters)
	{
		if (_buffer[action] && angular.equals(parameters, _buffer[action].parameters))
		{
			var deferred = $q.defer();

			deferred.resolve(_buffer[action].response);

			if (!_buffer[action].isPermanent)
			{
				delete _buffer[action];
			}
			
			return deferred.promise;
		}

		var deferred = $q.defer();
		var message = {
			action: action
		};

		var userId;

		if (localStorage && localStorage.getItem)
		{
			userId = localStorage.userId;
		}
		else
		{
			userId = cookie.read('userId');
		}
		if (userId)
		{
			message.userId = userId;
		}

		if (parameters)
		{
			message.parameters = parameters;
		}

		$http({
			method: 'POST',
			url: '/',
			data: message			
		})
		.then(
			function(response)
			{
				var responseData = response.data;

				if (responseData.status === 'error') 
				{
					showDialog(responseData.data);
					deferred.reject();
					return;
				}

				_buffer = angular.extend(_buffer, responseData.buffer);

				if (localStorage && localStorage.setItem)
				{
					localStorage.setItem('userId', responseData.userId);
				}
				else
				{
					cookie.write('userId', responseData.userId);
				}

				deferred.resolve(responseData.data);
			},
			function(response, r)
			{
				showDialog(response.statusText);
				deferred.reject();
			}
		);

		return deferred.promise;
	};
})
.service('webSocket', function($q, cookie, showDialog)
{
	var _service = this;
	var _loader = $q.defer();

	_service.loader = _loader.promise;
	_service.onconnect = null;
	_service.supported = !!WebSocket;

	if (!_service.supported)
	{
		_loader.resolve();
		return;
	}

	var _webSocket;
	var _requests = {};
	var _listeners = {};
	var _buffer = {};
	var _protocol = (location.protocol === 'https' ? 'wss://' : 'ws://');

	function connect()
	{
		_webSocket = new WebSocket(protocol + location.host);
	}

	// Catch if server does not support WebSockets
	try
	{
		connect();
	}
	catch (err)
	{
		_service.supported = false;
		_loader.resolve();
		return;
	}

	_webSocket.onmessage = function(messageEvent)
	{
		try
		{
			var response = JSON.parse(messageEvent.data);
			var deferred = _requests[response.requestId];

			if (response.status === 'error') 
			{
				showDialog(response.data);
				deferred.reject();
				return;
			}

			_buffer = angular.extend(_buffer, response.buffer);

			if (localStorage && localStorage.setItem)
			{
				localStorage.setItem('userId', responseData.userId);
			}
			else
			{
				cookie.write('userId', responseData.userId);
			}

			for (var key in _listeners)
			{
				if (key === response.requestId)
				{
					_listeners[key](response.data);
					return;
				}
			}

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
		if (_service.onconnect)
		{
			_service.onconnect(true);
		}
		_loader.resolve();
	}

	_webSocket.onclose = function()
	{
		if (_service.onconnect)
		{
			_service.onconnect(false);
		}
		connect();
	}

	_service.addListener = function(key, callback)
	{
		_listeners[key] = callback;
	};

	_service.fetch = function(action, parameters)
	{
		if (_buffer[action] && angular.equals(parameters, _buffer[action].parameters))
		{
			var deferred = $q.defer();

			deferred.resolve(_buffer[action].response);

			if (!_buffer[action].isPermanent)
			{
				delete _buffer[action];
			}
			
			return deferred.promise;
		}

		var message = {
			requestId: Math.random().toString().substr(2),
			action: action
		};

		var userId;

		if (localStorage && localStorage.getItem)
		{
			userId = localStorage.userId;
		}
		else
		{
			userId = cookie.read('userId');
		}
		if (userId)
		{
			message.userId = userId;
		}

		if (parameters)
		{
			message.parameters = parameters;
		}
			
		var deferred = _requests[message.requestId] = $q.defer();		

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
.service('serverComm', function($q, http, webSocket)
{
	var _service = this;
	var _loader = $q.defer();
	var _serverComm;

	_service.loader = _loader.promise;

	$q.all([
		http.loader,
		webSocket.loader
	]).then(function()
	{
		_loader.resolve();

		if (webSocket.supported)
		{
			_service.fetch = webSocket.fetch;
			_service.usingWebSocket = true;
		}
		else
		{
			_service.fetch = http.fetch;
			_service.usingWebSocket = false;
		}
	});

	_service.readStore = function(name)
	{
		if (localStorage && localStorage.getItem)
		{
			return JSON.parse(localStorage[name]);
		}
		else
		{
			return JSON.parse(cookie.read(name));
		}
	};

	_service.writeStore = function(name, data)
	{
		if (localStorage && localStorage.setItem)
		{
			localStorage.setItem(name, JSON.stringify(item));
		}
		else
		{
			cookie.write(name, JSON.stringify(item));
		}
	};

	_service.deleteStore = function(name)
	{
		if (localStorage)
		{
			delete localStorage[name];
		}
		else
		{
			cookie.delte(name);
		}
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