/*
 *	Thread safe iterator
 *
 * 		Iterator = require('./iterator');
 * 
 *		Iterator(<start>, <end>, [<step>], <callback>);
 *
 * 			iterates from <start> to <end> with steps of <step>, which is optional (default: 1)
 * 			<callback> is: function(index, isFirst, isLast),
 *
 * 		Iterator(<target>, <callback>);
 * 
 * 			iterates all items in <target>, which is either an Array or an Object
 * 			<callback> is: function(item, index, isFirst, isLast)
 * 
 * 		<callback> can return boolean true to stop iteration
 */
module.exports = function(start, end, step, callback)
{
	if (!!(end && end.constructor && end.call && end.apply))
	{
		callback = end;

		if (Array.isArray(start))
		{
			if (start.length > 0)
			{
				end = start.length - 1;
				iterateArray(start, 0);
			}
			return;
		}

		step = Object.keys(start);

		if (step.length > 0)
		{
			end = step.length - 1;
			iterateObject(0);
		}

		return;
	}

	if (!!(step && step.constructor && step.call && step.apply))
	{
		callback = step;
		step = 1;
		iterateUp(start);
		return;
	}

	if (step > 0)
	{
		iterateUp(start);
		return;
	}
	if (step < 0)
	{
		iterateDown(start);
		return;
	}

	function iterateArray(index)
	{
		setTimeout(function()
		{
			if (callback(start[index], index, index === 0, index === end) !== true && ++index <= end)
			{
				iterateArray(index);
			}
		});
	}

	function iterateObject(index)
	{
		setTimeout(function()
		{
			if (callback(start[step[index]], index, index === 0, index === end) !== true && ++index <= end)
			{
				iterateObject(index);
			}
		});
	}

	function iterateUp(index)
	{
		setTimeout(function()
		{
			if (callback(index, index === start, index === end) !== true)
			{
				index += step;
				if (index <= end)
				{
					iterateUp(index);
				}
			}
		});
	}

	function iterateDown(index)
	{
		setTimeout(function()
		{
			if (callback(index, index === start, index === end) !== true)
			{
				index += step;
				if (index >= end)
				{
					iterateDown(index);
				}
			}
		});
	}
};
