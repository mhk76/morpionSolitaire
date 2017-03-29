angular.module('MorpionSolitaire', ['Tools'])
.controller('GameController', function($scope, $q, dictionary, showDialog, webSocket)
{
	const __boardSize = 40;
	const __gridSize = 20;
	const __lineLength = 4;
	const __dirUpLeft = 0;
	const __dirUp = 1;
	const __dirUpRight = 2;
	const __dirLeft = 3;
	const __dirRight = 4;
	const __dirDownLeft = 5;
	const __dirDown = 6;
	const __dirDownRight = 7;
	const __line = [
		{ x: -1, y: -1 },
		{ x: 0, y: -1 },
		{ x: 1, y: -1 },
		{ x: -1, y: 0 },
		{ x: 1, y: 0 },
		{ x: -1, y: 1 },
		{ x: 0, y: 1 },
		{ x: 1, y: 1 }
	];

	$scope.data = {
		top: 5,
		left: 5,
		grid: new Array(__boardSize),
		drawLine: false,
		selectionX: null,
		selectionY: null,
		undo: []
	};

	Math.TAU = 2 * Math.PI;
	Math.Tan16th = Math.tan(Math.PI / 8);
	Math.TanThree16th = Math.tan(3 * Math.PI / 8)

	for (var i = 0; i < $scope.data.grid.length; i++)
	{
		$scope.data.grid[i] = new Array(40);
	}

	$q.all([dictionary.loader, webSocket.loader]).then(function()
	{
		webSocket.getData('get').then(function(data)
		{
			angular.extend($scope.data, data);

			for (var i = 0; i < $scope.data.list.length; i++)
			{
				var item = $scope.data.list[i];
				$scope.data.grid[item.y][item.x] = item;
			}

			drawGrid();
		})
	});

	var board = document.getElementById('board');
	var _canvas = board.getContext('2d');

	_canvas.font = '8px Arial'
	_canvas.fillStyle = '#000';
	_canvas.lineWidth = 2;	

	$board = $(board)
		.on('mousemove', function(event) {
			$scope.data.cursorX = event.offsetX;
			$scope.data.cursorY = event.offsetY;
			$scope.data.selectionX = parseInt(event.offsetX / __gridSize + 0.5);
			$scope.data.selectionY = parseInt(event.offsetY / __gridSize + 0.5);

			drawGrid();
		})
		.on('mousedown', function(event)
		{
			if (!$scope.data.placeDot && !$scope.data.drawLine && !$scope.data.drawLineStart)
			{
				var x = parseInt(event.offsetX / __gridSize + 0.5);
				var y = parseInt(event.offsetY / __gridSize + 0.5);

				if ($scope.data.grid[y + $scope.data.top][x + $scope.data.left])
				{
					$scope.data.drawLine = true;
					$scope.data.drawLineStart = true; 
					$scope.data.lineX = parseInt(event.offsetX / __gridSize + 0.5);
					$scope.data.lineY = parseInt(event.offsetY / __gridSize + 0.5);

					drawGrid();
				}
			}
		})
		.on('mouseup', function(event)
		{
			if ($scope.data.placeDot)
			{
				var x = parseInt(event.offsetX / __gridSize + 0.5) + $scope.data.left;
				var y = parseInt(event.offsetY / __gridSize + 0.5) + $scope.data.top;

				if ($scope.data.grid[y][x] == null)
				{
					var item = {
						x: x,
						y: y,
						line: [false, false, false, false, false, false, false, false],
						ordinal: ++$scope.data.ordinal
					}
					$scope.data.grid[y][x] = item; 
					$scope.data.list.push(item);
					$scope.data.placeDot = false;
					$scope.data.undo.push({ dot: true, x: x, y: y });
				}
			}
			else if ($scope.data.drawLineStart)
			{
				$scope.data.drawLineStart = false;
			}
			else if ($scope.data.drawLine)
			{
				var line = checkLine();

				if (line.ok)
				{
					var ix = $scope.data.left + $scope.data.lineX;
					var iy = $scope.data.top + $scope.data.lineY;

					$scope.data.undo.push({ dot: false, x: ix, y: iy, dx: line.direction, dy: line.reverse });

					for (var i = 0; i <= __lineLength; i++)
					{
						if (i < __lineLength)
						{
							$scope.data.grid[iy][ix].line[line.direction] = true;
						}
						if (i > 0)
						{
							$scope.data.grid[iy][ix].line[line.reverse] = true;
						}

						ix += line.x;
						iy += line.y;
					}

					$scope.data.drawLine = false;
					$scope.data.placeDot = true;
				}
			}

			drawGrid();
		})

	function drawGrid()
	{
		_canvas.clearRect(0, 0, 601, 601);

		var by = $scope.data.top;
		var dy = 0;
		var line = { x: 0, y: 0, ok: false };
		var lineOk = false;

		if ($scope.data.drawLine)
		{
			line = checkLine();
		}

		for (var y = 0; y < 31; y++)
		{
			var bx = $scope.data.left;
			var dx = 0;

			for (var x = 0; x < 31; x++)
			{
				var item = $scope.data.grid[by][bx];

				if (x === $scope.data.selectionX && y === $scope.data.selectionY)
				{
					if ($scope.data.placeDot && item == null)
					{
						board.style.cursor = 'pointer';
						_canvas.beginPath();
						_canvas.arc(dx, dy, 7, 0, Math.TAU);
						_canvas.fill();
					}
					else
					{
						board.style.cursor = 'default';
					}
					if (!$scope.data.placeDot)
					{
						if ($scope.data.drawLine)
						{
							board.style.cursor = 'pointer';
							_canvas.beginPath();
							_canvas.lineWidth = 3;
							_canvas.moveTo($scope.data.lineX * __gridSize, $scope.data.lineY * __gridSize);
							_canvas.lineTo(($scope.data.lineX + line.x * __lineLength) * __gridSize, ($scope.data.lineY + line.y * __lineLength) * __gridSize);
							if (line.ok)
							{
								_canvas.strokeStyle = '#0c0';
							}
							else
							{
								_canvas.strokeStyle = '#c00';
							}
							_canvas.stroke();
						}
						else if (item != null)
						{
							board.style.cursor = 'pointer';
							_canvas.beginPath();
							_canvas.moveTo(dx - 10, dy - 10);
							_canvas.lineTo(dx + 10, dy + 10);
							_canvas.moveTo(dx - 10, dy + 10);
							_canvas.lineTo(dx + 10, dy - 10);
							_canvas.moveTo(dx - 10, dy);
							_canvas.lineTo(dx + 10, dy);
							_canvas.moveTo(dx, dy - 10);
							_canvas.lineTo(dx, dy + 10);
							_canvas.strokeStyle = '#000';
							_canvas.lineWidth = 3;
							_canvas.stroke();
						}
					}
				}
				else
				{
					board.style.cursor = 'default';
				}
				if (item != null)
				{
					defaultDot(dx, dy, item);
				}

				++bx;
				dx += __gridSize;
			}

			++by;
			dy += __gridSize;
		}

		function defaultDot(dx, dy, item)
		{
			_canvas.beginPath();
			_canvas.arc(dx, dy, 7, 0, Math.TAU);
			_canvas.lineWidth = 1;
			_canvas.strokeStyle = '#000';
			_canvas.stroke();

			if (item.ordinal)
			{
				var ordinal = item.ordinal.toString();		
				_canvas.fillText(ordinal, dx - parseInt(_canvas.measureText(ordinal).width / 2), dy + 3);
			} // if (ordinal)

			_canvas.beginPath();
			_canvas.lineWidth = 3;

			if (item.line[__dirUp])
			{
				_canvas.moveTo(dx, dy - 7);
				_canvas.lineTo(dx, dy - __gridSize / 2);
			}
			if (item.line[__dirUpRight])
			{
				_canvas.moveTo(dx + 5, dy - 5);
				_canvas.lineTo(dx + __gridSize / 2, dy - __gridSize / 2);
			}
			if (item.line[__dirRight])
			{
				_canvas.moveTo(dx + 7, dy);
				_canvas.lineTo(dx + __gridSize / 2, dy);
			}
			if (item.line[__dirDownRight])
			{
				_canvas.moveTo(dx + 5, dy + 5);
				_canvas.lineTo(dx + __gridSize / 2, dy + __gridSize / 2);
			}
			if (item.line[__dirDown])
			{
				_canvas.moveTo(dx, dy + 7);
				_canvas.lineTo(dx, dy + __gridSize / 2);
			}
			if (item.line[__dirDownLeft])
			{
				_canvas.moveTo(dx - 5, dy + 5);
				_canvas.lineTo(dx - __gridSize / 2, dy + __gridSize / 2);
			}
			if (item.line[__dirLeft])
			{
				_canvas.moveTo(dx - 7, dy);
				_canvas.lineTo(dx - __gridSize / 2, dy);
			}
			if (item.line[__dirUpLeft])
			{
				_canvas.moveTo(dx - 5, dy - 5);
				_canvas.lineTo(dx - __gridSize / 2, dy - __gridSize / 2);
			}
			_canvas.stroke();
		} // function defaultDot
	}

	function checkLine()
	{
		var dx = $scope.data.selectionX - $scope.data.lineX * __gridSize; 
		var dy = $scope.data.selectionY - $scope.data.lineY * __gridSize;
		var tan = (dx !== 0 ? dy / dx : dy);
		var output = { x: 0, y: 0, direction: 0, reverse: 0, ok: false };

		if (dx  < 0)
		{
			if (tan > Math.TanThree16th)
			{
				output.direction = __dirUp;
				output.reverse = __dirDown;
			}
			else if (tan > Math.Tan16th)
			{
				output.direction = __dirUpLeft;
				output.reverse = __dirDownRight;
			}
			else if (tan > -Math.Tan16th)
			{
				output.direction = __dirLeft;
				output.reverse = __dirRight;
			}
			else if (tan > -Math.TanThree16th)
			{
				output.direction = __dirDownLeft;
				d1 = __dirUpRight
			}
			else
			{
				output.direction = __dirDown;
				output.reverse = __dirUp;
			}
		}
		else
		{
			if (tan > Math.TanThree16th)
			{
				output.direction = __dirDown;
				output.reverse = __dirUp;
			}
			else if (tan > Math.Tan16th)
			{
				output.direction = __dirDownRight;
				output.reverse = __dirUpLeft;
			}
			else if (tan > -Math.Tan16th)
			{
				output.direction = __dirRight;
				output.reverse = __dirLeft;
			}
			else if (tan > -Math.TanThree16th)
			{
				output.direction = __dirUpRight;
				output.reverse = __dirDownLeft;
			}
			else
			{
				output.direction = __dirUp;
				output.reverse = __dirDown;
			}
		}

		output.x = __line[output.direction].x;
		output.y = __line[output.direction].y;

		var ix = $scope.data.left + $scope.data.lineX;
		var iy = $scope.data.top + $scope.data.lineY;

		for (var i = 0; i <= __lineLength; i++)
		{
			if (check(ix, iy, output.direction, output.reverse, i === 0, i === __lineLength))
			{
				return output;
			}

			ix += output.x;
			iy += output.y;
		}

		output.ok = true;

		return output;

		function check(x, y, direction, reverse, first, last)
		{
			if ($scope.data.grid[y][x] == null)
			{
				return true;
			}
			if (!last && $scope.data.grid[y][x].line[direction])
			{
				return true;
			}
			if (!first && $scope.data.grid[y][x].line[reverse])
			{
				return true;
			}
			return false;
		}
	}

});