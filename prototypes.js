Number.prototype.leftPad = function(length, padChar)
{
	var output = this.toString();

	if (output.length < length)
	{
		return (padChar || '0').toString().substr(0, 1).repeat(length - output.length) + output;
	}

	return output.slice(-length);
};

String.prototype.appendTrail = function(trail)
{
	if (typeof trail !== 'string' || trail.length === 0)
	{
		throw 'Invalid trail string';
	}
	if (this.slice(-trail.length) !== trail)
	{
		return this + trail;
	}
	return this;
};