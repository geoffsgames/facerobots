//Blinder/////////////////////////////////////
var dontScrambleRotations = true;
var origKeyCodes = {up:38, left:37, right:39, down:40, clockwise:16, anticlockwise:13}


Scrambler.prototype = Object.create( MagicBlock.prototype );


function Scrambler(type, ownerGrid, ownerImage,  owner, myX, myY, offsetX, offsetY, pointX, pointY){
	MagicBlock.prototype.setup.call(this, type, ownerGrid, ownerImage,  owner, myX, myY, offsetX, offsetY, pointX, pointY);
}

Scrambler.prototype.activateMagicEffect = function(){
	this.victim.scramble(this);
}