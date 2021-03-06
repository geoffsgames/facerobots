"use strict";
var numPlayers = 2;
var completeCounter = 0;//counts how many players have completed their animation so game only increments when all animation finished
var intermediate = false;
var fastMoving = false;
var debugMode = false;

var waitingForRival = false;
var rivalTimeCounter = 0;

//just for testing
var testingStuckRotation = false;
var oldTime = new Date();

var Person = function (myX, myY, facing) {
	if(myX != undefined)
		this.setup(myX,myY, facing);
};

Person.prototype.findWeapons = function() {
	//add strength of nearby weapons
	for (let weap of this.weapons){
		if(weap.finalStrength == undefined)
			weap.finalStrength = weap.weaponStrength;
		
		for (let weap2 of this.weapons){
			if(weap2 != weap){
				var dis = Math.abs(weap2.myX - weap.myX) + Math.abs(weap2.myY - weap.myY);
				if(weap.pointX == weap2.pointX && weap.pointY == weap2.pointY)
					weap.finalStrength += weap2.weaponStrength / dis;
				else if(weap.secondPointX == weap2.pointX && weap.secondPointY == weap2.pointY)
					weap.finalStrength += weap2.weaponStrength / (dis * 3);
				else
					weap.finalStrength += weap2.weaponStrength / (dis * 6);
			}
			
		}
	}
	
	this.dangerZones = {}; //parts of this robot with a lot of/powerful weapons ranked
	for (let weap of this.weapons){
		var str = weap.finalStrength;
		
		//way a dangerous weapon is pointing is considered a dangerous direction
		if(weap.pointX == 1){
			if(this.dangerZones.right == undefined || str > this.dangerZones.right.strength)
				this.dangerZones.right = {strength:str, along:weap.myY};
		}
		else if(weap.pointX == -1){
			if(this.dangerZones.left == undefined || str > this.dangerZones.left.strength)
				this.dangerZones.left = {strength:str, along:weap.myY};
		}
		else if(weap.pointY == 1){
			if(this.dangerZones.bottom == undefined || str > this.dangerZones.bottom.strength)
				this.dangerZones.bottom = {strength:str, along:weap.myX};
		}
		else if(weap.pointY == -1){
			if(this.dangerZones.top == undefined || str > this.dangerZones.top.strength)
				this.dangerZones.top = {strength:str, along:weap.myX};
		}
		
		//secondary points are unblocked knives near a particular side of the robot but not actually pointing that way
		if(this.fasterSpeeds == [0,0,0,0]){ //not worth considering side strengths if I have fans
			str = str / 5;
			if(weap.secondPointX == 1){
				if(this.dangerZones.right == undefined || str > this.dangerZones.right.strength)
					this.dangerZones.right = {strength:str, along:weap.myY};
			}
			else if(weap.secondPointX == -1){
				if(this.dangerZones.left == undefined || str > this.dangerZones.left.strength)
					this.dangerZones.left = {strength:str, along:weap.myY};
			}
			else if(weap.secondPointY == 1){
				if(this.dangerZones.bottom == undefined || str > this.dangerZones.bottom.strength)
					this.dangerZones.bottom = {strength:str, along:weap.myX};
			}
			else if(weap.secondPointY == -1){
				if(this.dangerZones.top == undefined || str > this.dangerZones.top.strength)
					this.dangerZones.top = {strength:str, along:weap.myX};
			}
		}
		weap.finalStrength = weap.weaponStrength; //reset weapon strength for next time
	}
	
	if(this.dangerZones.top == undefined)
		this.dangerZones.top = {strength:0.01, along:(this.gridSize / 2)}
	if(this.dangerZones.left == undefined)
		this.dangerZones.left = {strength:0.01, along:(this.gridSize / 2)}
	if(this.dangerZones.bottom == undefined)
		this.dangerZones.bottom = {strength:0.01, along:(this.gridSize / 2)}
	if(this.dangerZones.right == undefined)
		this.dangerZones.right = {strength:0.01, along:(this.gridSize / 2)}
	
	///////////////add in fans
	//fs = top, right, bottom, left
	this.dangerZones.top.strength *= (this.fasterSpeeds[0] + 1);
	this.dangerZones.right.strength *= (this.fasterSpeeds[1] + 1);
	this.dangerZones.bottom.strength *= (this.fasterSpeeds[2] + 1);
	this.dangerZones.left.strength *= (this.fasterSpeeds[3] + 1);

	
};


Person.prototype.setup = function(myX, myY, facing) {
	this.readyToMove = true;
	this.facing = facing;
	this.origFacing = facing;
	this.myX = myX;
	this.myY = myY;
	this.movX = 0;
	this.movY = 0;
	this.startCounter = 10;
	this.counter = 0;
	this.rotation = 0;
	this.dead = false;
	this.willStop = false;
	this.willshrink = false;
	this.totalNumBlocks = 0;
	this.setupGrid(0,myX,myY);
	this.creep = false;
	this.creeped = false;
	this.inventoryTypes = new Array();
	this.inventoryQuants = new Array();
	this.inventoryImages = new Array(); 
	this.inventoryText = new Array();
	this.collecting = new Array();
	this.motors = new Array();
	this.fasterSpeeds = [0,0,0,0]; //Function of how many fans there are on N,E,S or W side of robot
	this.fastSpeed_fixed = 1; //how many times default speed I'm now travelling (check?)
	this.justResumed = false;
	this.hasLeftGrid = false;
	//this.myBlocks = new Array();
	
	this.movefastCounter = 1;
	this.fastSpeed_changing = 1; //how many times other robot's speed I'm now travelling (check?)
	
	this.motorWillStart = null;
	
	this.partsMoving = false;
	
	//used for fans NOT motors
	this.faster = true;
	this.jumpingBack = false;
	this.tinyAnimateCount = 0;
	this.extracted = true;
	this.lastFace = this.mainFace;
	this.changedDir = true;
	this.totalRotate = 0;
	this.willFinishRotating = -1;
	
	this.damaged = false;
	
	this.recreateable = true;

	this.motorJustStopped = false;
	this.curArea = null;
	this.weapons = new Set();
	this.fans = new Set();
	
	this.keyCodes = [];
	this.isRivalIcon = false;
	//scrambling key codes when hit with a scramble block
	this.updateKeyCodes();

	this.extractionRetries = 5;
	this.closeEnDis = 0;
	this.lastVis = true;
};


Person.prototype.updateKeyCodes = function(){
	this.keyCodes = [];
	//scrambling key codes when hit with a scramble block
	for (const [key, value] of Object.entries(selectedKeyCodes)) {
		this.keyCodes[value] = key;
	}
}



Person.prototype.resetWeapons = function(){
	for (let weap of this.weapons){
		weap.weaponStrength = weap.origWeaponStrength;
		if(weap.spring != null)
			weap.weaponStrength = Math.min(maxSpeed,Math.pow(2,weap.spring.quantity));
	}
}

Person.prototype.rotateMotors = function(angle){
	for(var i =0; i < this.motors.length; i+= 1){
		this.motors[i].rotate(angle);
	}
}

//load saved game - build from string describing grid
Person.prototype.loadFromText = function(text){
	var bits = text.split("_");
	var textGrid = bits[0];
	var myX = parseInt(bits[1]);
	var myY = parseInt(bits[2]);
	var facing = parseInt(bits[5]);
	this.setup(myX, myY, facing);
	this.initializeFromTextGrid(textGrid);
	this.movX = parseInt(bits[3]);
	this.movY = parseInt(bits[4]);

};


Person.prototype.initializeFromTextGrid = function(text) {
	var bits = text.split("s");//before s = size (width and height), after = grid separated by ,
	var size = parseInt(bits[0]);
	var vals = bits[1].split(",");
	this.textGrid = new Array(size);
	for(var i =0; i < size; i += 1)
		this.textGrid[i] = new Array(size);
	
	var x = 0;
	var y = 0;
	for(var i =0; i < vals.length; i += 1){
		if(y == size){
			y = 0;
			x += 1;
		}
		this.textGrid[x][y] = vals[i];
		var bits = vals[i].split(".");
		if(bits.length > 1){ //if it is a block and not simply "0"
			this.addPiece(x,y,bits[0],true);
			this.totalNumBlocks += 1;
			var origResistance = this.grid[x][y].resistance;
			this.grid[x][y].resistance = parseInt(bits[1]);
			if(this.grid[x][y].resistance < origResistance) //the "wobbling" effect when it't just been hit
				this.grid[x][y].showDamage();
		}
		y += 1;
	}
};

Person.prototype.setupGrid = function(size, myX,myY) {
	this.gridSize = size;

	this.grid = new Array(size);
	for(var i =0; i < size; i+= 1){
		this.grid[i] = new Array(size);
	}

	if(debugMode){
		this.textGrid = new Array(size);
		for(var i =0; i < size; i+= 1){
			this.textGrid[i] = new Array(size);
			this.textGrid[i].fill("0");
		}
	}
	
	//the visual
	this.group = new fabric.Group([], {
		  left: myX * gridWidth + ((this.gridSize * gridWidth) / 2),
		  top: myY * gridHeight + ((this.gridSize * gridHeight) / 2)
		});
	
	this.visuallyFacing = this.facing;
	//if(this.isEnemy)
		//console.trace();
	canvas.add(this.group);
	this.group.selectable = false;
};

Person.prototype.lostKnife = function(block){
	
};

Person.prototype.resetNewXY = function(){
	if(this.newX == undefined)
		return
		
	if((!intermediate || this.faster  || this.movethistime) && !this.partsMoving && !(player.willResetInterval || enemy.willResetInterval)){
		if(this.newX == this.myX && this.newY == this.myY)
			this.newX = undefined;
		else{
			this.myX = this.newX;	
			this.myY = this.newY;
			this.newX = undefined;
			this.shrink();
		}
		this.recreated = false;
	}
}

Person.prototype.calcCloseToEnemy = function(){
	var en = this.getOtherRobot();
	var dis = 999;

	if(this == player || this.closeEnDis == 999){
		var meL = this.myX + this.minX;
		var meR = this.myX + this.maxX;
		var meT = this.myY + this.minY;
		var meB = this.myY + this.maxY;
		
		var enL = en.myX + en.minX;
		var enR = en.myX + en.maxX;
		var enT = en.myY + en.minY;
		var enB = en.myY + en.maxY;
		
		//if enemy has just rotated and extracted and not updated it's position yet use the potential position
		if(en.newX != undefined){
			enL += (en.newX - en.myX);
			enR += (en.newX - en.myX);
			enT += (en.newY - en.myY);
			enB += (en.newY - en.myY);
		}
		
		if ( (enT <= meB && enT >= meT) || (enB <= meB && enB >= meT) || (enT <= meT && enB >= meB)) //overlap on the left/right side
			dis = Math.min(Math.abs(enL - meL),Math.abs(enL - meR),Math.abs(enR - meL),Math.abs(enR - meR), (Math.abs(meL - enL) / (enR - enL)) * 2, (Math.abs(enL - meL) / (meR - meL)) * 2) //last expression ensuring for robots totally in the middle dis < 2
		else if ( (enL <= meR && enL >= meL) || (enR <= meR && enR >= meL) || (enL <= meL && enR >= meR)) //overlap on the top/bottom side
			dis = Math.min(Math.abs(enT - meT),Math.abs(enT - meB),Math.abs(enB - meT),Math.abs(enB - meB), (Math.abs(meT - enT) / (enB - enT)) * 2, (Math.abs(enT - meT) / (meB - meT)) * 2)
		if(isNaN(dis))
			dis = 0;
	}
	else
		dis = this.closeEnDis;
			
	if(en.partsMoving)
		this.closeToEnemy = dis <= (maxSpeed / this.fastSpeed_fixed) + 1;
	else if(this.faster)
		this.closeToEnemy = dis <= 2;
	else
		this.closeToEnemy = dis <= en.fastSpeed_changing + 1;
	
	
	if(this == player)
		enemy.closeEnDis = dis;
	
}

Person.prototype.adjustCloseToEnemy = function(){
	this.closeEnDis = 999;
	this.calcCloseToEnemy();
	if(this.closeToEnemy && !this.gridUpdated())
		this.updateGrid(false);
	
}

Person.prototype.gridUpdated = function(){
	if(this.heart.myX + this.myX >= numPiecesX || this.heart.myX + this.myX < 0 || this.heart.myY + this.myY >= numPiecesY || this.heart.myY + this.myY < 0)
		return true; //when leaving land - for some reason I sometimes am drawn and better to be safe
	var testSq = gameGrid[this.heart.myX + this.myX][this.heart.myY + this.myY]; //use the heart to find out if I did infact draw me last time
	return (testSq != undefined && testSq != 1 && testSq != null && testSq.type == "heart");
	
}

//when player enters new arena and is moving fast some times doesn't render until removed and readded
Person.prototype.ensureVisibility = function(){
	if(this.fastSpeed_fixed == 1) //only need to do this when it's moving fast
		return;
	if(intermediate && !this.faster)
		return;
	var vis = this.group.left > 0 && this.group.top > 0 && this.group.left + this.actualWidth < canvas.width && this.group.top + this.actualHeight < canvas.height;
	if(vis && !this.lastVis){
		canvas.remove(this.group);
		canvas.add(this.group);
		canvas.requestRenderAll();
		if(!intermediate || this.faster){
			this.group.left = (this.myX * gridWidth) + ((this.gridSize * gridWidth) / 2);
			this.group.top = (this.myY * gridHeight) + ((this.gridSize * gridHeight) / 2);
		}	
	}
	this.lastVis = vis;

}

Person.prototype.update = function() {
	this.ensureVisibility(); //if I'm moving very fast and just left screen will need to redraw when I've reentered
	if(!intermediate)
		this.maybeRotateHeart();
	
	if(Math.random() < 0.2 && this.isHurt){
		this.isHurt = false;
		this.resetFace(this.mainFace);
	}

	if(!intermediate && this.damaged){
		for(var i =0; i < this.motors.length; i+= 1){
			this.motors[i].needsCalc = true;
		}
		this.damaged = false;
	}
	
	if(this.newX == undefined)//if haven't just rotated. When I've just rotated my REAL position (i.e. not position I'm moving into and it looks like I'm in) may be half over wall! So if I try clearing out now I'll clear a chunk of wall!
		this.updateGrid(true);//true so clears player from game grid
	if(!this.partsMoving && this.rotation == 0 && this.willshrink){//if player has reshaped change grid into smallest square around new shape
		this.shrink();
		this.willshrink = false;
	}
	var moved = false;
	if(this.willStop){
		this.stop(); //including activateEditing in player
		this.willStop = false;
	}
	else{
		
		if(!frozeWaitingForEnemy){
			this.moveParts();
			moved = this.move(); //note - it is in this method where this.myX = this.newX is called
		}
	}
	this.moved = false;
	if(moved){
		if(this.newX == undefined)
			this.collided = this.checkCollision();
		else{
			this.animate();
			return;
		}
		
		if(!this.collided){//checkCollision returns true if I've jumped back
			if(this.dead)
				allComplete();
			else{
				this.alreadyMagiced = false;
				this.updateGrid(false);
				this.animate();
			}
		}
		else{
			this.updateGrid(false);
			allComplete();//haven't moved (blocked) so don't wait for animate to finish
		}
		
	}
	else if(intermediate && !this.collided){
		if(this.newX == undefined)
			this.updateGrid(false);
		this.animate();
	}
	else{
		if(this.newX == undefined)
			this.updateGrid(false);
		allComplete();//haven't moved so don't wait for animate to finish
	}
	
	//document.getElementById("test").innerHTML = this.myX + " " + this.myY;
	

};

Person.prototype.updateGrid = function(clear){
	if(this.partsMoving && !this.motorJustStopped)
		return;
	this.motorJustStopped = false;
	if(clear){
		this.calcCloseToEnemy();
		if(this.gridUpdated()){ //if was drawn to grid last time
			for(var x = 0; x <= this.gridSize; x += 1){
				for(var y = 0; y <= this.gridSize; y += 1){ //TODO currently works because two objects can't overlap 
															//If that changes then this will need of change!
					if(this.grid[x] != undefined && x + this.myX >= 0 && x + this.myX < numPiecesX && y + this.myY >= 0 && y + this.myY < numPiecesY && this.grid[x][y] != undefined && this.grid[x][y] != null)
						gameGrid[x + this.myX][y + this.myY] = 1; //origGrid[x + this.myX][y + this.myY]; //TODO - two loops could be combined to make more efficient
				}
			}
		}
	}
	else{
		if(this.closeToEnemy){
			console.log("close to enemy");
			for(var x = this.minX; x <= this.maxX; x += 1){
				for(var y = this.minY; y <= this.maxY; y += 1){
					if(this.grid[x][y] != null && this.grid[x][y] != 0)
						if(this.grid[x] != undefined && x + this.myX >= 0 && x + this.myX < numPiecesX && y + this.myY >= 0 && y + this.myY < numPiecesY && this.grid[x][y] != undefined && this.grid[x][y] != null)
							gameGrid[x + this.myX][y + this.myY] = this.grid[x][y]; //TODO - two loops could be combined to make more efficient
				}
			}
		}
	}
}



Person.prototype.moveParts = function() {
	if(!this.partsMoving)
		return false;
	
	var partsMoved = false;
	for(var i =0, len = this.motors.length ; i < len; i += 1){
		var mot = this.motors[i];
		if(mot != null){
			if(mot.update()){
				partsMoved = true;
			}
			else{//has been destroyed
				if(this.motors[i] != mot)
					i -= 1;
			}
		}
	}
	this.partsMoving = partsMoved;
	
	if(!this.partsMoving){
		this.shrink();
	}
	
	
};

Person.prototype.stop = function() {
};

Person.prototype.isStopped = function() {
	var stopped = ((this.movX == 0 && this.movY == 0) || this.jumpedBack);
	return stopped;
};


Person.prototype.isMoving = function(){
	return this.movX != 0 || this.movY != 0;
}

function makeAnimateString(anim){
	if(anim > 0){
		return "+=" + anim;
	}
	else{
		return "-=" + (-anim);
	}
}

function tinyAnimate(dis,group,movX,movY, obj){
	if(dis <= gridWidth || obj.tinyAnimateCount == (dis / gridWidth) - 1){
		obj.tinyAnimateCount = 0;
		if(movX != 0)
			group.left += (movX * (gridWidth / dis));
		else
			group.top += (movY * (gridHeight / dis));
	}
	else{
		obj.tinyAnimateCount = obj.tinyAnimateCount + 1;
	}
};

Person.prototype.resetAngle = function() {
	this.group.angle = Math.round(this.group.angle / 90) * 90;
};

//rotate face back to upright if needed and not in the middle of rotation
Person.prototype.maybeRotateHeart = function(){

}

Person.prototype.animate = function() {
	var group = this.group;
	var movX = this.movX;
	var movY = this.movY;
	var rotation = this.rotation;
	var dist = (initialInterval / interval) / this.fastSpeed_fixed;
	if(!this.recreated && (movX != 0 || movY != 0 || rotation != 0)){
		if((interval < 50 || dist >= (gridWidth / 2)) && rotation == 0){
			tinyAnimate(dist,group,movX,movY,this);
			allComplete();
			return;
		}
		this.tinyAnimateCount = 0;
		group.originX = "center";
		group.originY = "center";
		
		if(this.rotation != 0){
			
			if(intermediate){
				allComplete();
			}
			else{
				if(this == player)
					animating = true; //not used for anything
				this.moved = true;
				if(dist > 1)
					waitingForRotate = true;
				if(this.extracted){ //successfully avoided walls
					this.totalRotate += (90 * this.rotation);
					if(Math.abs(this.totalRotate) == 360)
						this.totalRotate = 0;
					
					group.animate('angle', makeAnimateString(90 * this.rotation), {
						myIntermediate: dist > 1,
						//onChange: canvas.renderAll.bind(canvas),
						onComplete: function(){
							if(!this.myIntermediate)
								allComplete();
							else{
								wakeRotateWait();
							}
			            },
			         duration: initialInterval
					});
	
					
					//if when rotating had to adjust position because was overlapping wall - animate out of wall
					if(this.newX != undefined && this.myX != this.newX){				
						this.moved = true;
						group.animate('left', makeAnimateString((this.newX - this.myX) * gridWidth), {
					         duration: initialInterval
							});
					}
					if(this.newY != undefined && this.myY != this.newY){
						this.moved = true;
						
						group.animate('top', makeAnimateString((this.newY - this.myY) * gridHeight), {
					         duration: initialInterval
							});
					}	
				}
				else{//can't rotate - try to rotate a little bit then collapse back
					var disTried = Math.maybeSeededRandom(0.2,0.5);
					group.animate('angle', makeAnimateString(Math.floor((disTried * 90)  * this.rotation)), {//go out
			            owner : this,
			            dis: disTried,
			            rotation: this.rotation,
						myIntermediate: dist > 1,
						onComplete: function(){//go back
							this.owner.group.animate('angle', makeAnimateString(Math.floor((this.dis * 90)  * -this.rotation)), {
					            owner: this.owner,
					            myIntermediate: this.myIntermediate,
								onComplete: function(){
					            	this.owner.resetAngle();
					            	if(!this.myIntermediate)
					            		allComplete();
					            	else
										wakeRotateWait();
					            },
					         duration: Math.floor((initialInterval / 2) * this.dis)
							});
			            },
			         duration: Math.floor((initialInterval / 2) * disTried)
					});
	
				}
				if(dist == 1) //not in situations where the other robot is moving the motor/moving faster and I'm adjusting accordingly
					this.rotation = 0;
				else
					allComplete();
			}

		}//end of rotation just linear movement below
		else{
			if(movX != 0){
				this.moved = true;
				group.animate('left', makeAnimateString(Math.round(gridWidth / dist) * movX), {
			            onComplete: function(){
			            	allComplete();
			            },
			         duration: interval,
			         easing: fabric.util.ease.easeInSine
					});
			}
			else if(movY != 0){
				this.moved = true;
				
				group.animate('top', makeAnimateString(Math.round(gridHeight / dist) * movY), {
			            onComplete: function(){
			            	allComplete();
			            },
			         duration: interval,
			         easing: fabric.util.ease.easeInSine
					});
			}
		}
	}
	else{ //no movement
		if(this == player)
			animating = true;
		allComplete();
	}
};

Person.prototype.desiredVisualTop = function(){
	return (gridHeight * (((this.maxY - this.minY) / 2) + this.minY + this.myY)) + (gridHeight / 2);
}

Person.prototype.desiredVisualLeft = function(){
	return (gridWidth * (((this.maxX - this.minX) / 2) + this.minX + this.myX)) + (gridWidth / 2);
}

function allComplete(){
	completeCounter += 1;
	waitingForRival = false;
	if(completeCounter == numPlayers){
		if(inPVP){
			//console.log("I'm completed");
			//"I'm done"
			socket.emit("allComplete_rival", {uID:uniqueID, tCounter:rivalTimeCounter, time:oldTime});
			
			//move on only if rival also done
			if(rivalCompleted)
				allComplete2();
			else
				waitingForRival = true;
		}
		else
			allComplete2();

	}
};

function allComplete2(){
	completeCounter = 0;
	
	if(inPVP){
		rivalTimeCounter++;
		waitingForRival = false;
		rivalCompleted = false;
	}
	
	//if neither moved - wait as no delay for animation would otherwise make things too fast TODO - if add more than 1 enemy
	var actualIntv = new Date() - oldTime;
	if(interval > actualIntv)
		waitForTimeout(interval - actualIntv);
	else{
		if(actualIntv - interval > 50)
			countLag += 1;
		oldTime = new Date(); //set oldTime for next turn
		updateGame();
	}
}

//redraw after enter new landscape
Person.prototype.restart = function(){
	clearLandscape(); //clears collectables and enemy
	if(willRestart == "right"){
		curSeed += seedJumpX;
		this.myY = newXYForNeighbour(rightGrid,this.myY + this.minY,this.maxY - this.minY + 1,gameGrid[0].length,rightGrid.grid[0].length, rightGrid.grid.length,true,"left") - this.minY ;			
		start(); //sets up landscape and redraws everything
		this.myX = - this.maxX - 1;
		this.justArrived = true;
		clearOldNeighbours(rightGrid);
		
	}
	else if(willRestart == "left"){
		//for memory = clear out grids which won't be next to me
		curSeed -= seedJumpX;
		this.myY = newXYForNeighbour(leftGrid,this.myY + this.minY,this.maxY - this.minY + 1,gameGrid[0].length,leftGrid.grid[0].length,leftGrid.grid.length, true, "right")- this.minY;			
		start();//sets up landscape and redraws everything
		this.myX = numPiecesX - this.minX;
		this.justArrived = true;
		clearOldNeighbours(leftGrid);
	}
	else if(willRestart == "bottom"){
		curSeed += seedJumpY;
		this.myX = newXYForNeighbour(bottomGrid,this.myX + this.minX,this.maxX - this.minX + 1,gameGrid.length,bottomGrid.grid.length, bottomGrid.grid[0].length,true,"top") - this.minX ;
		start();//sets up landscape and redraws everything
		this.myY = - this.maxY - 1;
		this.justArrived = true;			
		//for memory = clear out grids which won't be next to me			
		clearOldNeighbours(bottomGrid);
	}
	else if(willRestart == "top"){
		curSeed -= seedJumpY;
		this.myX = newXYForNeighbour(topGrid,this.myX + this.minX,this.maxX - this.minX + 1,gameGrid.length,topGrid.grid.length,topGrid.grid[0].length, true, "bottom")- this.minX;
		start();//sets up landscape and redraws everything
		this.myY = numPiecesY - this.minY;
		this.justArrived = true;
		//for memory = clear out grids which won't be next to m
		clearOldNeighbours(topGrid);
	}	
	
	
	this.group.left = (this.myX * gridWidth) + ((this.gridSize * gridWidth) / 2);
	this.group.top = (this.myY * gridHeight) + ((this.gridSize * gridHeight) / 2);
	//if(this.isEnemy)
		//console.trace();
	canvas.add(this.group); //because new canvas will not have added this yet
	scrollToPlayer();
	canvas.renderAll();
};

Person.prototype.scroll = function(){
	
};


Person.prototype.growGrid = function(newX, newY){
	this.willRecreate = false;
	if(this.minX == undefined || newX < this.minX)
		this.minX = newX;
	else if(this.maxX == undefined || newX > this.maxX)
		this.maxX = newX;
	if(this.minY == undefined || newY < this.minY)
		this.minY = newY;
	else if(this.maxY == undefined || newY > this.maxY)
		this.maxY = newY;
	
	//if grid needs to grow as new piece would be off top/left
	var adj = Math.max(Math.max(-newX,-newY));
	if(newX > 0 || newY > 0)
		adj = Math.max(newX-this.gridSize+1,newY-this.gridSize+1);	
	if(newX < 0 || newY < 0){
		var adj = Math.max(-newX,-newY);
		this.myX -= adj;
		this.myY -= adj;
		var newGrid = new Array(this.gridSize + adj);
		//copy the old grid onto the new grid
		for(var x = 0; x< adj; x+= 1)
			newGrid[x] = new Array(this.gridSize + adj);
		for(var x = 0; x < this.gridSize; x += 1){
			newGrid[x + adj] = new Array(this.gridSize + adj);
			if(x < this.gridSize){
				for(var y = 0; y < this.gridSize; y += 1){
					if(this.grid[x] != undefined && this.grid[x][y] != undefined){
						newGrid[x + adj][y + adj] = this.grid[x][y];
						newGrid[x + adj][y + adj].ownerGrid = newGrid;
						newGrid[x + adj][y + adj].myX += adj;
						newGrid[x + adj][y + adj].myY += adj;
					}
				}
			}
		}
		this.gridSize += adj;
		this.grid = newGrid;
		if(this.heart != undefined)
			this.heart.image.bringToFront();

		newX += adj;
		newY += adj;
		
		this.maxX += adj;
		this.minX += adj;
		this.minY += adj;
		this.minX += adj;
		
		if(debugMode && !fromTextGrid){
			this.recreateTextGrid(newGrid);
		}
	}	//if grid needs to grow as new piece would be off bottom/right
	else if(newX >= this.gridSize || newY >= this.gridSize){
		
		
		var adj = Math.max(newX - this.gridSize,newY - this.gridSize) + 1;
		var oldGridSize = this.gridSize;
		
		this.gridSize = Math.max(newX,newY) + adj;
		
		var newGrid = new Array(this.gridSize);
		//copy the old grid onto the new grid
		for(var x = 0; x < this.gridSize; x += 1){
			newGrid[x] = new Array();
			if(x < oldGridSize){
				for(var y = 0; y < oldGridSize; y += 1){
					if(this.grid[x] != undefined && this.grid[x][y] != undefined){
						newGrid[x][y] = this.grid[x][y];
						newGrid[x][y].ownerGrid = newGrid;
					}
				}
			}
		}
		this.grid = newGrid;
		//visually re adds the old blocks after enlarging
		this.willRecreate = true;
		if(debugMode && !fromTextGrid){
			this.recreateTextGrid(newGrid);
		}
		if(this.heart != undefined)
			this.heart.image.bringToFront();

	}
	return [newX,newY];
};

//newX, newY position within owner
//offsetX, offsetY for how the fabric groups are constructed TODO switch to addWithUpdate
//pointX, pointY for direction knives etc pointing (not used right now - calculated with knife)
Person.prototype.addPiece = function(newX, newY, blocktype, fromTextGrid, recreatingGroup, pointX, pointY) {
	var newXY = this.growGrid(newX,newY); //possibly grow grid to accommodate (if needed newX will be off limits e.g. -1, or same as gridSize)
	newX = newXY[0]; //if grid grown block will gain new coordinations within grid
	newY = newXY[1];
	if(this.willRecreate)
		this.recreateGroup(0,0);
	
	if(debugMode && !fromTextGrid){
		if(newX >= this.textGrid.length || newY >= this.textGrid.length){
			this.recreateTextGrid(this.grid);
		}
		if(newX >= this.textGrid.length || newY >= this.textGrid.length)
			alert("ERROR");
		else
			this.textGrid[newX][newY] = blocktype + "." + this.grid[newX][newY].resistance;
	}
	

	addGridSquare(newX, newY, blocktype, this.grid, this.group,this,    ((this.gridSize * gridWidth) / 2), ((this.gridSize * gridWidth) / 2),pointX,pointY);
	
	if(this.grid[newX][newY].isWeapon){
		this.weapons.add(this.grid[newX][newY]);
		this.grid[newX][newY].checkForSprings();
	}
	if(this.grid[newX][newY].type == "spring"){
		this.grid[newX][newY].checkForWeapons();
	}
	
	if(!recreatingGroup){
			if(this.occupied(newX + 1, newY)){
				this.grid[newX + 1][newY].calculatePoints();
				this.grid[newX + 1][newY].redraw(true);
			}
			if(this.occupied(newX - 1, newY)){
				this.grid[newX - 1][newY].calculatePoints();
				this.grid[newX - 1][newY].redraw(true);
			}
			if(this.occupied(newX, newY + 1)){
				this.grid[newX][newY + 1].calculatePoints();
				this.grid[newX][newY + 1].redraw(true);
			}
			if(this.occupied(newX, newY - 1)){
				this.grid[newX][newY - 1].calculatePoints();
				this.grid[newX][newY - 1].redraw(true);
			}
	}
	return this.grid[newX][newY];
	
};

Person.prototype.occupied = function(x, y){
	if(x >= this.gridSize || x < 0 || y >= this.gridSize || y < 0)
		return false;
	if(this.grid[x] == undefined || this.grid[x][y] == undefined || this.grid[x][y] == null)
		return false;
	return true;
};


Person.prototype.recreateTextGrid = function(grid){
	var size = grid.length;
	var newTextGrid = new Array(size);
	for(var x = 0; x < size; x+= 1){
		newTextGrid[x] = new Array(size);
		newTextGrid[x].fill("0");
		for(var y = 0; y < size; y+= 1){
			if(grid[x][y] != null && grid[x][y] != undefined)
				newTextGrid[x][y] = grid[x][y].type + "." + grid[x][y].resistance;
		}
	}
	
	this.textGrid = newTextGrid;
};


//if overlapping a wall (e.g. after just gone down stairs)then move until not overlapping any more
Person.prototype.extractFromOverlap = function(count_max, onlyScenery){
	if(onlyScenery == undefined)
		onlyScenery = false;
	var isOverlap = true;
	var count = 0;
	var other = this.getOtherRobot();
	while(isOverlap && count < count_max){
		var overlaps = [];
		isOverlap = false;
		//for every square on me check if it overlaps landscape obstacles
		for(var x = this.minX; x <= this.maxX; x += 1){
			for(var y = this.minY; y <= this.maxY; y += 1){
				//if I've already been there don't go there again
				
				if(this.grid[x][y] != null){ //if this square is a used square on me (note *on me*, not *on the landscape*)
					if(this.myX + x < 0)//if a block is off grid to the left then record this so that moving right will be a possible correction
						overlaps.push("left");
					else if(this.myX + x >= numPiecesX)//if a block is off grid to the right then record left as possible correction
						overlaps.push("right");
					else if(this.myY + y >= numPiecesY)
						overlaps.push("bottom");
					else if(this.myY + y < 0)
						overlaps.push("top");
					else if(gameGrid[this.myX + x][this.myY + y] != 1 || (!onlyScenery && other.onMe(this.myX + x - other.myX,this.myY + y - other.myY))){
						isOverlap = true;
						if(x == this.minX)//if a block on the left of me overlaps landscape obstacle 
							overlaps.push("left");
						if(x >= this.maxX)
							overlaps.push("right");
						if(y == this.minY)
							overlaps.push("top");
						if(y >= this.maxY)
							overlaps.push("bottom");
					}
				}//TODO 30/8/2016 = -1's removed from >= is this right?
			}
		}
		if(overlaps.length > 0)
			isOverlap = true;
		if(isOverlap){
			var dir = 0;
			if(overlaps.length == 0){//if doesn't overlap on any particular side then still overlaps (e.g. overlaps isolated block in center)
				this.myX -= Math.floor(Math.maybeSeededRandom(-1,2));//move any direction
				this.myY += Math.floor(Math.maybeSeededRandom(-1,2));
			}
			else{//move according to which side I overlap
				
				//if trapped on both sides move at an adjacent direction. Prefer a direction already overlapping. 
				if(overlaps.includes("top") && overlaps.includes("bottom") && this.maxY - this.minY > 4){
					if(overlaps.includes("left") && !overlaps.includes("right"))
						overlaps = ["left"];
					else if(overlaps.includes("right") && !overlaps.includes("left"))
						overlaps = ["right"];
					else if(!overlaps.includes("right") && !overlaps.includes("left"))
						overlaps = ["left", "right"];
				}
				else if(overlaps.includes("left") && overlaps.includes("right") && this.maxX - this.minX > 4){
					if(overlaps.includes("top") && !overlaps.includes("bottom"))
						overlaps = ["top"];
					else if(overlaps.includes("bottom") && !overlaps.includes("top"))
						overlaps = ["bottom"];
					else if(!overlaps.includes("bottom") && !overlaps.includes("top"))
						overlaps = ["bottom", "top"];
				}
				
				
				
				dir = overlaps[Math.floor(Math.maybeSeededRandom(0, overlaps.length))];
			}
			if(dir == "left")
				this.myX += 1;
			else if(dir == "right")
				this.myX -= 1;
			else if(dir == "top")
				this.myY += 1;
			else
				this.myY -= 1;
		}
		count += 1;
	}
	return isOverlap;
};

Person.prototype.onMe = function(x, y){
	if(this.newX != undefined){
		x -= (this.newX - this.myX);
		y -= (this.newY - this.myY);
	}
	if(x < this.minX || x >= this.maxX || y < this.minY || y >= this.maxY)
		return false;
	if(this.grid[x] == undefined || this.grid[x][y] == undefined || this.grid[x][y] == null)
		return false;
	return true;
};

Person.prototype.startMotorsMoving = function(which){
	if(this.motors == undefined || this.motors == null || this.motors[which] == undefined || this.motors[which] == null || !this.motors[which].isWorking())
		return;
	this.mot = this.motors[which];
	if(!this.mot.canMove())
		return;
	
	if(this.newX != undefined){
		this.myX = this.newX;
		this.myY = this.newY;
		this.newX = undefined;
	}
	this.recreateGroup(0,0);
	if(this == player && selectedKeyCodes == newKeyCodes) //deselect the motor
		canvas.setActiveObject(delImg);

	this.mot.startMoving()
	this.partsMoving = true;

	
	this.oldMovX = this.movX;
	this.oldMovY = this.movY;
	
	this.movX = 0;
	this.movY = 0;
	this.getOtherRobot().adjustCloseToEnemy();
};


Person.prototype.checkCollision = function() {
	this.jumpedBack = false; //met any sort of resistance (even if I managed to damage the block)
	this.blocked = false; //met resistance where I didn't even damage the block (for resetting?) 
	
	//all the blocks changed in this loop
	var destroyBlocks = new Array();
	var modified = new Array();
	var collected = new Array();

	
	this.stairsCollide = null;
	var stillStairs = false;
	this.blockedByLandscape = false;
	var damagedOther = false;

	//collision with stairs
	var stairsOver = [];
	for(var i =0; i < land.numStairs; i+= 1){
		var stairs = land.stairs[i];
		if(this.minX + this.myX < stairs.x  + 2 && this.maxX + this.myX >= stairs.x &&
				this.minY + this.myY < stairs.y  + 2 && this.maxY + this.myY >= stairs.y)
		stairsOver.push(land.stairs[i]);
	}
	var numStairsOver = stairsOver.length;

	//collision with mainstream blocks
	for(var x = this.minX; x <= this.maxX; x += 1){
		for(var y = this.minY; y <= this.maxY; y += 1){
			var myBlock = this.grid[x][y];
			//blocks moving in a motor are tested for collision seperately
			if(myBlock != undefined && (myBlock.motor == null || myBlock.motor == undefined || !myBlock.motor.moving)){
				var blockX = this.myX + myBlock.myX;
				var blockY = this.myY + myBlock.myY;
				if(blockX >= 0 && blockX < numPiecesX && blockY >= 0 && blockY < numPiecesY){//not off edge
					var otherBlock = gameGrid[blockX][blockY];
					if(otherBlock == undefined){ //is an obstacle block that has not yet been added
						addRandomDirScenery(this.myX + x,this.myY + y,"obstacle");//draw obstacle wonky indicating damage
						otherBlock = gameGrid[this.myX + x][this.myY + y];
					}
					if(otherBlock != 1 && otherBlock != null && !otherBlock.isAddPlace && !(otherBlock.isDeletePlace && otherBlock.origOwner == this)){//is an obstacle
						if(otherBlock.ownerImage != this.group){//there is a collision
							if(this == enemy){
								//console.log("enemy collision");
								//console.log(myBlock.type);
								//console.log(myBlock.myX + " " + this.myX);
								//console.log(otherBlock.type);
								//console.log(otherBlock.myX);

							}
							this.handleCollision(myBlock,otherBlock,modified,destroyBlocks,collected,null);
						}
					}
					else{
						for(var s =0; s < numStairsOver; s+= 1){
							var stairs = stairsOver[s];
							var gapX = (blockX) - stairs.x;
							var gapY = (blockY) - stairs.y;
							if(gapX < 2 && gapY < 2 && gapX > - 1 && gapY > -1)
								this.stairsCollide = stairs;
		
						}
					}
				}
			}
		}
	}
	if(this.jumpedBack){
		
		if(this.jumpedBack){
			
			this.jumpBack(false);
			this.stuck = true;
		}
		else{
			this.stuck = false;
		}
		if(this.blocked){
			for(var i =0; i < modified.length; i += 1){
				modified[i].reset();
			}
		}
		else{
			for(var i =0; i < modified.length; i += 1){
				modified[i].confirmDamage();
				damagedOther = true;
			}

		}
	}	
	else{
		var owners = new Array();
		for(var i =0; i < modified.length; i += 1){
			modified[i].confirmDamage();
			damagedOther = true;
		}
		var editingVictim = null;
		for(var i =0; i < destroyBlocks.length; i ++){//record all enemies/landscape that possibly will be damaged	
			//collision in editing mode
			if(destroyBlocks[i].origOwner != undefined && destroyBlocks[i].origOwner != null && destroyBlocks[i].origOwner.isEditing()){
				editingVictim = destroyBlocks[i].origOwner
				editingVictim.leaveEditing(); //player has to be out of editing mode to respond to damage properly - will be put right back into editing mode after
				editingVictim.updateGrid(true);
				editingVictim.closeToEnemy = true;
				editingVictim.updateGrid(false);
			}
			if(editingVictim != null)
				destroyBlocks[i] = editingVictim.grid[destroyBlocks[i].myX - editingVictim.myX][destroyBlocks[i].myY - editingVictim.myY]
			if(destroyBlocks[i] != null){
				if(destroyBlocks[i].owner != undefined && destroyBlocks[i].owner != null && owners.indexOf(destroyBlocks[i].owner) === -1) //TODO owners.indexOf not implemented IE 8 and lower
					owners.push(destroyBlocks[i].owner);
				//damage me or collect block in here
				destroyBlocks[i].destroy(this,true);
			}
			

			
		}
	
		for(var i =0; i < owners.length; i += 1){//damage enemy/landscape
			//don't call shrink now because when colliding 
			//I'm one step further forward than I think I am
			//this effects recreate group which is why collecting adjusts recreate group
			owners[i].willshrink = true; 
			owners[i].respondToDamage();
			owners[i].damaged = true;
		}
		this.collecting = collected; //save collected blocks (previously just temporary in case blocked)
		if(this.collecting.length > 0) //add collected blocks to me
			this.collectAll();
	}
	
	if(this.damagedOther){
		this.respondToDamagedOther();
	}
	
	if(editingVictim != null && !editingVictim.dead)
		editingVictim.activateEditMode();
	
	this.heart.image.bringToFront();
	//canvas.renderAll();
	if(this.justArrived){
		this.justArrived = false;//otherwise would destroy the whole landscape!
	}return this.jumpedBack;
};



Person.prototype.handleCollision = function(myBlock, otherBlock,  modified, destroyed, collected, mot){
	var forwardStrength = myBlock.forwardStrength;
	var sideStrength = myBlock.sideStrength;
	
	if(this.justArrived){//so automatically destroys first layer of new landscape
		myBlock.forwardStrength = 9999;
		myBlock.sideStrength = 9999;
	}
	var movX = this.movX;
	var movY = this.movY;
	if(mot != undefined && mot != null){//TODO which motor
		movX = mot.movX;
		movY = mot.movY;
	}
	
	//other pointed against my direction of movement (doesn't take into account other's direction of movement - this will be handled in his collision detection check)
	var otherPointedAtMe = otherBlock.directionMatches(-movX,-movY);
	
	//I'm moving a certain way and pointing the same way
	var mePointedAtOther = myBlock.directionMatches(movX,movY);
	
	//other pointing towards me FROM BEHIND and I back onto him
	//this counts as other having advantage over me UNLESS I'm on a spring, otherwise it will happen all the time (because spring naturally moves block backwards)
	if(otherPointedAtMe && movX == -otherBlock.pointX && movY == -otherBlock.pointY && mot != undefined && mot.type == "spring") 
		otherPointedAtMe = false;
	
	
	var otherDestroyed = otherBlock.destroyedBy(myBlock, modified, destroyed, collected, mePointedAtOther,otherPointedAtMe,0,mot);
	var thisDestroyed = otherDestroyed == "collected" ? false : myBlock.destroyedBy(otherBlock, modified, destroyed, collected, otherPointedAtMe,mePointedAtOther,0,mot);								
	
	var thisormot = this;
	if(mot != undefined && mot != null)
		thisormot = mot;
		
	if(!otherDestroyed && !thisDestroyed && otherDestroyed != "collected") //blocked
		thisormot.jumpedBack = true;
	
	if(thisormot.jumpedBack && !otherBlock.isDamaged() && !myBlock.isDamaged()){//if I was blocked so any damage I may have done was in error so need to undo
		thisormot.blocked = true;
		if(otherBlock.owner == null) //is a landscape obstacle
			this.blockedByLandscape = true;
		if(myBlock.isMagic)
			myBlock.magicEffect(otherBlock);
		if(otherBlock.isMagic)
			otherBlock.magicEffect(myBlock);
	}

	
	if(myBlock.motor != undefined && myBlock.motor != null && myBlock.motor.moving && otherBlock.isDamaged()){
		myBlock.motor.collided = true;
	}								

	myBlock.forwardStrength = forwardStrength;
	myBlock.sideStrength = sideStrength;

};

Person.prototype.respondToDamage = function() {
	this.setupWeapons();
};

Person.prototype.respondToDamagedOther = function() {
};

Person.prototype.jumpBack = function() {

		//note = I only do collision detection if I've moved
		this.myX = this.myX - this.movX;
		this.myY = this.myY - this.movY;

};

Person.prototype.resetPos = function(){
	//TODO - later on could make it go slow for a few turns
	if(this.fastSpeed_changing == 1 && this.getOtherRobot().fastSpeed_changing > 1){
		this.group.left = (this.myX * gridWidth) + ((this.gridSize * gridWidth) / 2);
		this.group.top = (this.myY * gridHeight) + ((this.gridSize * gridHeight) / 2);
	}
};

//will only happen for the faster of the two robots
Person.prototype.checkIntermediate = function(){
	//check intermediate when I'm robot with moving motor or fan
	if(this.partsMoving){ //note - will only be one motor moving at once
		var stopped = true;
		for(var i =0, len = this.motors.length; i < len; i+= 1){
			if(this.motors[i] != null && !this.motors[i].checkIntermediate()) //checks if motor is ready for the next step (change direction at end of line or finish)
				stopped = false;
		}
		if(this.motorRestarted){//reversed
			//player.motorWillStart = null; //because startMotorsMoving won't be called this is the only place where can ensure doesn't automatically start again next time
			this.motorRestarted = false;
		}
		if(stopped) //motor has naturally finished
			this.stopMotors();
		
	}//check intermediate when other robot is robot with moving motor or fan
	else if(this.faster){
		if(this.fastSpeed_changing == 1 || this.movefastCounter == this.fastSpeed_changing){
			intermediate = false;
			this.movefastCounter = 0;
			if(this.willResetInterval)
				this.resetInterval();
		}
		else
			intermediate = true;
	}
};

Person.prototype.tryToSpeedUp = function() {
	
	if(!intermediate && !this.partsMoving && this.motorWillStart != null){
		this.startMotorsMoving(this.motorWillStart);
	}
	else if(!this.partsMoving){
		this.changeDir();
	}
	
	
};

Person.prototype.getMass = function(){
	return Math.ceil(this.totalNumBlocks / 8) - 1;
};


Person.prototype.changeDir = function(restarting){
	if(!this.readyToMove )
		return;
	
	if(!this.changedDir)
		return;
	var dir = 0;
	if(this.movY == -1)
		dir = 1;
	else if(this.movX == 1)
		dir = 2;
	else if(this.movY == 1)
		dir = 3;
	dir -= this.facing;
	if(dir < 0)
		dir += 4;
	dir -= 2;
	if(dir < 0)
		dir += 4;
	
	this.offsetDir = dir + (this.facing - this.origFacing);
	if(this.offsetDir >= 4){
		this.offsetDir = this.offsetDir - 4;
	}
	else if(this.offsetDir < 0){
		this.offsetDir = 4 + this.offsetDir;
	}
		
	
	this.resetFace(this.directionFaces[this.offsetDir]);
	this.resetPos();
	var otherRob = this.getOtherRobot();
	if(!otherRob.partsMoving)
		otherRob.resetPos();
	
	var newFastSpeed = Math.pow(2,this.fasterSpeeds[dir]);
	//newFastSpeed = 1 (no fans), 2, 4, 8, 16
	
	if(this.fasterSpeeds[dir] > 0){
		var mass = this.getMass();
		mass = Math.pow(2,mass - 1) //mass = 0.5, 1, 2, 4, 8
		newFastSpeed = Math.max(1,Math.min(maxSpeed,newFastSpeed / mass));
		if(!newFastSpeed in [1,2,4,8,16]){
			console.error("Invalid Fast Speed!")
		}
		if(this == player)
			reportMass(mass,this.fasterSpeeds[dir],newFastSpeed);
	}
	else if(this == player && message.text.search("boosters") > 0){//clear any mass messages
		message.set("fill", "green");
		message.set("text","World " + origSeed);
	}
	if(newFastSpeed != this.fastSpeed_fixed || restarting){ //changing speed
		this.fastSpeed_fixed = newFastSpeed;
		if(otherRob.readyToMove || restarting){
				if(otherRob.partsMoving){
						this.fastSpeed_changing = maxSpeed / this.fastSpeed_fixed;
				}
				else{
						if(otherRob.fastSpeed_fixed > this.fastSpeed_fixed){
							otherRob.faster = true;
							this.faster = false;
							interval = (initialInterval / otherRob.fastSpeed_fixed);
							otherRob.fastSpeed_changing = otherRob.fastSpeed_fixed / this.fastSpeed_fixed;
							this.fastSpeed_changing = 1;
						}
						else if(this.fastSpeed_fixed == otherRob.fastSpeed_fixed){
							this.faster = true;
							otherRob.faster = true;
							interval = initialInterval / this.fastSpeed_fixed;
							otherRob.fastSpeed_changing = 1;
							this.fastSpeed_changing = 1;
						}
						else{
							otherRob.faster = false;
							this.faster = true;
							interval = (initialInterval / this.fastSpeed_fixed);
							otherRob.fastSpeed_changing = 1;
							this.fastSpeed_changing = this.fastSpeed_fixed / otherRob.fastSpeed_fixed;
							otherRob.adjustCloseToEnemy(); //close to enemy is based on assumption my enemy will continue to move at same speed they've been moving before. 
															//Now need to adjust/ draw grid even though I thought I didn't need to
						}
						otherRob.movefastCounter = 0;
						this.movefastCounter = 0;
				}
		}
		else{
			interval = (initialInterval / this.fastSpeed_fixed);
			this.fastSpeed_changing = 1;
		}
	}
	this.changedDir = false;	


};

Person.prototype.resetFace = function(url,override){
	if(!override){
		if(this.isHurt && url != this.hurtFace && url != this.deadFace)
			return; //allow the hurt face to exist for a few turns
		if(this.heart.image._objects == undefined)
			return;
		if(this.blinder != undefined || this.blinder != null || this.scrambler != undefined || this.scrambler != null)
			return;
	}
	var oldWidth = this.heart.image._objects[0].width;
	var oldHeight = this.heart.image._objects[0].height;
	this.heart.image._objects[0].setElement(document.getElementById(url));
	this.heart.image._objects[0].width = oldWidth;
	this.heart.image._objects[0].height = oldHeight;
	this.lastFace = url;

};

Person.prototype.move = function() {
	//unless timer at min (i.e. partsmoving) its only the faster one that moves as it will always move a whole square
	if((!intermediate || this.faster  || this.movethistime) && !this.partsMoving){
		
		if(this.faster)
			this.movefastCounter += 1;
		//if partsMoving or catch up time post partsMoving then I'm not moving a whole square
		if(!(intermediate && (this.getOtherRobot().partsMoving || player.willResetInterval || enemy.willResetInterval)) || this.movethistime){
				this.recreated = false;
				this.movethistime= false;
				if(this.rotation == 0){//only move when not rotating
					if(this.creep){
						this.creeped = true;
						this.creep = false;
					}
					else if(this.creeped){
						this.creeped = false;
						this.movX = 0;
						this.movY = 0;
						return false;
					}
					if(this.newX != undefined){
						if(this.newX == this.myX && this.newY == this.myY)
							this.newX = undefined;
						else{
							this.myX = this.newX;	
							this.myY = this.newY;
							this.newX = undefined;
							this.shrink();
						}
						this.recreated = false;
						this.updateGrid(true);
					}
					
					this.myX = this.myX + this.movX;
					this.myY = this.myY + this.movY;
				}
				return true;
		}
	}
	this.movethistime= false;
	return false;
};

Person.prototype.getOtherRobot = function() {
	
};

Person.prototype.stairCollisions = function() {
	
};


Person.prototype.rotateAndExtract = function(){
	if(this.newX != undefined){//if I rotated on the previous but didn't call "move" so didn't update
		if(this.newX == this.myX && this.newY == this.myY)
			this.newX = undefined;
		else{
			this.myX = this.newX;
			this.myY = this.newY;
			this.newX = undefined;
			this.shrink();
		}
	}
	if(this.willRotate != undefined){
		this.rotation = this.willRotate;
		this.willRotate = 0;
	}
	this.updateGrid(true);//true so clears player from game grid
	this.rotate();
	var oldX = this.myX;
	var oldY = this.myY;
	this.extracted = !this.extractFromOverlap(this.extractionRetries);
	if(testingStuckRotation)
		this.extracted = false;
	if(!this.extracted){//if in too tight a spot then just rotate back
		this.rotation = -this.rotation;
		//reset my position because extractFromOverlap moves me
		this.myX = oldX;
		this.myY = oldY;
		//rotate back
		this.rotate();
		this.rotation = -this.rotation; //back to forward rotation so the animation works
	}

	//save my new position = animation will move me into it
	this.updateGrid(false); //note - this is after TEMPORARILY moving into correct position...
	this.newX = this.myX; //... AND move back (i.e. without horiz/verti adjustments - probably half way into wall). This is so animation will start from correct point. 
	this.newY = this.myY;
	this.myX = oldX;
	this.myY = oldY;
	
}

Person.prototype.rotate = function() {
	var rotation = this.rotation;
			
	//so that -2 becomes -1 and 2 becomes 1
	//don't worry - this.rotation will never be 3+ because then might as well rotate other way
	if(Math.abs(this.rotation) > 1)
		rotation = rotation / 2;

	
	this.maxX = 0; //the extremes of this robot (extremes of occupied blocks) so that can recreate grid smaller
	this.minX = this.gridSize - 1;
	this.maxY = 0;
	this.minY = this.gridSize - 1;


	var newgrid = new Array(this.gridSize);
	if(debugMode)
		var newTextGrid = new Array(this.gridSize);
	for(var i =0; i < this.gridSize; i+= 1){
		newgrid[i] = new Array(this.gridSize);
		if(this.debugMode){
			newTextGrid[i] = new Array(this.gridSize);
			newTextGrid[i].fill("0");
		}
	}
	var newX, newY;
	for(var x = 0; x < this.gridSize; x += 1){
		
		for(var y = 0; y < this.gridSize; y += 1){
			if(rotation == 1){
				newX = this.gridSize - y - 1;
				newY = x;
			}
			else{
				newY = this.gridSize - x - 1;
				newX = y;
			}
			
			if(this.grid[x][y] != undefined && this.grid[x][y] != null){
				if(newX < this.minX)
					this.minX = newX;
				if(newX > this.maxX)
					this.maxX = newX;
				if(newY < this.minY)
					this.minY = newY;
				if(newY > this.maxY)
					this.maxY = newY;
			}
			if(debugMode)
				newTextGrid[newX][newY] = this.textGrid[x][y]
			if(this.grid[x][y] != undefined && this.grid[x][y] != null){
				newgrid[newX][newY] = this.grid[x][y];
				//make sure blocks reference the correct grid (the new grid)
				newgrid[newX][newY].resetGrid(newgrid,newX,newY);
				newgrid[newX][newY].rotatePoint(rotation);

			}

		}
	
	}
	
	//REDO TO
	//0 = left, 1 = top, 2 = right, 3 = down

	//1 = top, 2 = right, 3 = down, 4 = left
	this.facing += rotation;
	if(this.facing >= 4)
		this.facing -= 4;
	if(this.facing < 0)
		this.facing += 4;
	
	this.grid = newgrid;
	this.textGrid = newTextGrid;

	this.rotateMotors(rotation);
	this.rotateDangerZones(rotation);
};

Person.prototype.rotateDangerZones = function(rotation){
	var savedLeft = this.dangerZones.left;
	if(rotation == -1){
		this.dangerZones.left = this.dangerZones.top;
		this.dangerZones.top = this.dangerZones.right;
		this.dangerZones.right = this.dangerZones.bottom;
		this.dangerZones.bottom = savedLeft;
		this.dangerZones.left.along = this.gridSize - this.dangerZones.left.along - 1;
		this.dangerZones.right.along = this.gridSize - this.dangerZones.right.along - 1;
	}
	else if(rotation == 1){
		this.dangerZones.left = this.dangerZones.bottom;
		this.dangerZones.bottom = this.dangerZones.right;
		this.dangerZones.right = this.dangerZones.top;
		this.dangerZones.top = savedLeft;
		this.dangerZones.bottom.along = this.gridSize - this.dangerZones.bottom.along - 1;
		this.dangerZones.top.along = this.gridSize - this.dangerZones.top.along - 1;
	}
	else
		console.error("unknown rotation value");
}

//when damaged or finished editing redraw and re-gridout whole group
Person.prototype.recreateGroup = function(offsetX, offsetY) {
	if(!this.recreateable)
		return;

	this.recreated = true;
	canvas.remove(this.group);

	this.group = new fabric.Group([], {
		left: this.myX * gridWidth + ((this.gridSize * gridWidth) / 2) + offsetX,
		top: this.myY * gridHeight + ((this.gridSize * gridHeight) / 2) + offsetY,
	});
	this.visuallyFacing = this.facing;

	this.group.selectable = false;
	//if(this.isEnemy)
		//console.trace();
	canvas.add(this.group);

	if(this.stoppedBlocks != null && this.stoppedBlocks != undefined){
		for(var i =0; i < this.stoppedBlocks.length; i+= 1)
			canvas.remove(this.stoppedBlocks[i]);
	}

	var newXY, newX, newY;
	for(var x = 0; x < this.gridSize; x += 1){
		for(var y =0; y < this.gridSize; y += 1){
			if(this.grid[x][y] != null && this.grid[x][y] != undefined){

				
				newXY = this.growGrid(x,y);
				newX = newXY[0];
				newY = newXY[1];
				
				this.grid[newX][newY].recreate(this.group, newX, newY, ((this.gridSize * gridWidth) / 2), ((this.gridSize * gridWidth) / 2));

			}
				
		}
	}
	if(this.heart != undefined){
		//identifies the player
		if(inPVP && this == player){
			this.group.add(new fabric.Circle({left:0, top:0, radius:50, fill:"blue", opacity:0.5, originX:"center",originY:"center"}));
		}
		if(this.lastFace != undefined && this.lastFace != null)
			this.resetFace(this.lastFace, true);
		this.heart.image.bringToFront();

	}

	this.actualWidth = gridWidth * this.gridSize;
	this.actualHeight = gridHeight * this.gridSize;
	

};

//all collectable blocks - because I may have simultaneously collided with multiple
Person.prototype.collectAll = function(){
	//remove from collectables

	
	for(var i =0; i < this.collecting.length; i += 1){
		var block = this.collecting[i];
		var x = block.myX;
		var y = block.myY;
		gameGrid[x][y].destroy(this,true);
		for(var c = 0; c < collectables.length; c += 1){
			if(collectables[c].x == x && collectables[c].y == y){
				collectables.splice(c,1);
				break;
			}
		}
		if(block.isWeapon || block.isSpecial)
			numSpecialCols --;
		if(enemy.target == block) //in case thief was aiming for this block stop it doing so
			enemy.target = null;
		
		if(block.isSpecial && this == player){
			message.set("text","You have just collected a " + block.type);
			message.set('fill', 'green');
		}
		var newBlock = null;
		if(block.pointSet)
			newBlock = this.addPiece(block.myX - this.myX + this.movX, block.myY - this.myY + this.movY, block.type, false, false,block.pointX,block.pointY);	
		else
			newBlock = this.addPiece(block.myX - this.myX + this.movX, block.myY - this.myY + this.movY, block.type, false, false);	
		this.totalNumBlocks += 1;
	}

	this.recreateGroup((-this.movX * gridWidth), (-this.movY * gridHeight) );
	this.recreated = false;
	this.collecting = [];
	this.setupWeapons();
};

Person.prototype.reverse = function() {
	this.movX = -this.movX;
	this.movY = -this.movY;
};


Person.prototype.shrink = function(){
	if(this.partsMoving)
		return;
	this.maxX = 0; //the extremes of this robot (extremes of occupied blocks) so that can recreate grid smaller
	this.minX = this.gridSize - 1;
	this.maxY = 0;
	this.minY = this.gridSize - 1;
	
	for(var x = 0; x < this.gridSize; x += 1){
		for(var y = 0; y < this.gridSize; y += 1){
			if(this.grid[x] != undefined && this.grid[x][y] != undefined && this.grid[x][y] != null){
					if(x > this.maxX)
						this.maxX = x;
					if(x < this.minX)
						this.minX = x;
					if(y > this.maxY)
						this.maxY = y;
					if(y < this.minY)
						this.minY = y;
			}
		}
	}
	
	//how much bigger x is than y
	var gapXY = (this.maxX - this.minX) - (this.maxY - this.minY)
	var adjX = 0;
	var adjY = 0;

	
	//for long objects put them at centre
	if(gapXY > 1)
		adjY = Math.floor(gapXY / 2);
	else if(gapXY < -1)
		adjX = -Math.ceil(gapXY / 2);

	
	//recreate grid smaller
	var newWidth = this.maxX - this.minX + 1;
	var newHeight = this.maxY - this.minY + 1;
	var newSize = Math.max(newWidth, newHeight);
	var newGrid = new Array(newSize);
	for(var x = this.minX; x < this.minX + newSize; x += 1){
		if(newGrid[x - this.minX] == undefined)
			newGrid[x - this.minX] = new Array(newSize);
		if(x - this.minX + adjX < newSize && newGrid[x - this.minX + adjX] == undefined)
			newGrid[x - this.minX + adjX] = new Array(newSize);

		for(var y = this.minY; y < this.minY + newSize; y += 1){
			if(this.grid[x] != undefined && this.grid[x][y] != undefined && this.grid[x][y] != null){
				newGrid[x - this.minX + adjX][y - this.minY + adjY] = this.grid[x][y];
				newGrid[x - this.minX + adjX][y - this.minY + adjY].ownerGrid = newGrid;
				newGrid[x - this.minX + adjX][y - this.minY + adjY].myX -= (this.minX - adjX);
				newGrid[x - this.minX + adjX][y - this.minY + adjY].myY -= (this.minY - adjY);
			}
		}
	}
	this.grid = newGrid;
	this.gridSize = newSize;
	this.myX += this.minX - adjX;
	this.myY += this.minY - adjY;
	if(this.newX != undefined){
		this.newX += this.minX - adjX;
		this.newY += this.minY - adjY;
	}
	
	this.dangerZones.top.along = this.dangerZones.top.along - this.minX + adjX;
	this.dangerZones.bottom.along = this.dangerZones.bottom.along - this.minX + adjX;
	this.dangerZones.right.along = this.dangerZones.right.along - this.minY + adjY;
	this.dangerZones.left.along = this.dangerZones.left.along - this.minY + adjY;
	if(this.contactSide != undefined && this.contactSide != null){
		this.contactX = t.contactX;
		this.contactY = selectedTurn.contactY;
	}
	
	this.maxX -= this.minX + adjX;
	this.minX = adjX;
	this.maxY -= this.minY + adjY;
	this.minY = adjY;
		
	if(this.grid == undefined)
		alert("shrink problem, grid undefined");
	if(debugMode)
		this.recreateTextGrid(this.grid);
	
	this.recreateGroup(0,0);
};

//if destroying a block leaves a gap then remove all the blocks on the opposite (non heart) side of the gap
Person.prototype.destroyNeighbourBlocks = function(x,y, explode){

	if(this.areGaps(x,y)){
		var heartChecked = this.heart.checkedForGaps;
		for(var x = 0; x < this.gridSize; x += 1){
			for(var y = 0; y < this.gridSize; y += 1){
				if(this.grid[x] != undefined && this.grid[x][y] != undefined && this.grid[x][y] != null){
					if(this.grid[x][y].checkedForGaps != heartChecked) //on the other side of the gap to the heart
						this.grid[x][y].clearAway(explode);
				}
			}
		}
	}
	for(var x = 0; x < this.gridSize; x += 1){
		for(var y = 0; y < this.gridSize; y += 1){
			if(this.grid[x][y] != undefined && this.grid[x][y] != null)
				this.grid[x][y].checkedForGaps = null;
		}
	}
};

//for motor - get section it moves
Person.prototype.getNeighbourBlocks = function(neighbourBlocks,x,y){
	if(this.areGaps(x,y)){
		var heartChecked = this.heart.checkedForGaps;
		for(var x = 0; x < this.gridSize; x += 1){
			for(var y = 0; y < this.gridSize; y += 1){
				if(this.grid[x] != undefined && this.grid[x][y] != undefined && this.grid[x][y] != null){
					if(this.grid[x][y].checkedForGaps != heartChecked) //on the other side of the gap to the heart
						neighbourBlocks.push(this.grid[x][y]);
				}
			}
		}
	}
	
	
	for(var x = 0; x < this.gridSize; x += 1){
		for(var y = 0; y < this.gridSize; y += 1){
			if(this.grid[x][y] != undefined && this.grid[x][y] != null)
				this.grid[x][y].checkedForGaps = null;
		}
	}
	return neighbourBlocks;
};

//happens not just when robot killed but also to enemies when player leaves the arena (or they wonder out the arena)
	//hence the "explode" parameter. When false this stops the usual death animation (blocks flying everywhere) happening 
	//as this should only happen when I die properly (i.e. not because player left the arena)
Person.prototype.die = function(explode){
	var otherRob = this.getOtherRobot();
	if(otherRob.scrambler != undefined && otherRob.scrambler != null && otherRob.scrambler.owner == this)
		otherRob.unscramble();
	this.resetFace(this.deadFace);
	this.dead = true;
	for(var x = 0; x < this.gridSize; x += 1){
		for(var y = 0; y < this.gridSize; y += 1){
			if(this.grid[x] != undefined && this.grid[x][y] != undefined && this.grid[x][y] != null)
				this.grid[x][y].clearAway(explode); //get rid of each piece, will fly away if explode is true
		}
	}

};

//if removing this block will leave a gap (this block is a bridge)
Person.prototype.areGaps = function(x,y){
	
	var numRight = this.areGapsDirection(x, y, 0, 1, 0, "right");
	if(numRight == this.totalNumBlocks) //no gaps (can reach all blocks by heading right from here so can't be bridge)
		return false;
	
	//(heading right produces 0 = this block is on the right edge so will have to test it going left instead)
	
	var numLeft = this.areGapsDirection(x, y, 0, -1, 0, "left");
	if(numLeft == this.totalNumBlocks) //no gaps
		return false;
	
	//(heading left produces 0 as well as heading right = this block on a vertical peninsula - will have to check heading up or down)
	
	var numDown = this.areGapsDirection(x, y, 0, 0, 1, "down");
	if(numDown == this.totalNumBlocks) //no gaps
		return false;
	
	var numUp = this.areGapsDirection(x, y, 0, 0, -1, "up");
	if(numUp == this.totalNumBlocks) //no gaps
		return false;
	
	return true;
};

Person.prototype.areGapsDirection = function(stX, stY, num, xDir, yDir, dir){
	var x = stX, y = stY;
	while(true){
		x += xDir;
		y += yDir;
		if(x < 0 || x == this.gridSize || y < 0 || y == this.gridSize)//reached edge grid
			return num;
		if(this.grid[x] == undefined || this.grid[x][y] == undefined || this.grid[x][y] == null) //reached edge shape
			return num;
		if(this.grid[x][y].checkedForGaps == dir ) //if already found
			return num;
		this.grid[x][y].checkedForGaps = dir;
		num += 1;
		if(xDir != 0){//recursively check branches
			num = this.areGapsDirection(x, y, num, 0, 1, dir);
			num = this.areGapsDirection(x, y, num, 0, -1, dir);
		}
		else{
			num = this.areGapsDirection(x, y, num, 1, 0, dir);
			num = this.areGapsDirection(x, y, num, -1, 0, dir);
		}
			
	}

};

Person.prototype.setMovement = function(x, y) {
	if(x != 0 && (this.myY + this.minY < 0 || this.myY + this.maxY >= numPiecesY)) //moving sideways while hanging off top or bottom of grid not allowed as messes up into/out of patterns
		return;
	if(y != 0 && (this.myX + this.minX < 0 || this.myX + this.maxX >= numPiecesX)) //moving sideways while hanging off top or bottom of grid not allowed as messes up into/out of patterns
		return;

	this.movX = x;
	this.movY = y;
};

//if I've knocked out a section of the wall so show the next section in (as it previously wasn't exposed we didn't bother to draw it)
Person.prototype.buildWallInfront = function() {
	for(var x = 0; x < this.gridSize; x+= 1){
		for(var y = 0; y < this.gridSize; y+= 1){
			if(gameGrid[this.myX + x + this.movX][this.myY + y + this.movY] == undefined || gameGrid[this.myX + x + this.movX][this.myY + y + this.movY] == null)
				addRandomDirScenery(this.myX + x + this.movX,this.myY + y + this.movY,"obstacle");
		}
	}
};

//TODO think about collisions when I'm in edit mode! I'd be in a different position to expected!
//replaying player modifying robot
Person.prototype.redrawFromTextGrid = function(text){	
	var bits = text.split("s");
	var size = parseInt(bits[0]);
	var vals = bits[1].split(",");
	
	var x = 0;
	var y = 0;
	
	this.textGrid = new Array(size);
	this.textGrid[0] = new Array(size);

	for(var i =0; i < size; i += 1){
		this.textGrid[i] = new Array(size);
	}

	var failedToAddAll = false;
	for(var i =0; i < vals.length; i += 1){
		if(y == size){
			x += 1;
			y = 0;
		}
		this.textGrid[x][y] = vals[i];
		var bits = vals[i].split(".");
		if(bits.length > 1){//add a block that isn't empty to the real grid
			if(!(this.grid[x][y] == null || this.grid[x][y] == undefined) && this.grid[x][y].type != bits[0]){
				this.deleteBlock(gameGrid[this.myX + x][this.myY + y].image);
			}
			if(this.grid[x][y] == null || this.grid[x][y] == undefined){
				this.selectedType = bits[0];
				
				if(gameGrid[this.myX + x][this.myY + y].isAddPlace)
					this.convertAddPlace(gameGrid[this.myX + x][this.myY + y]);
				else
					failedToAddAll = true;
			}
		}
		else if(x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize && this.grid[x][y] != undefined && this.grid[x][y] != null){
			this.deleteBlock(gameGrid[this.myX + x][this.myY + y].image);
		} 
		y += 1;
	}
	
	//can only add new blocks next to existing blocks (as per regular adding blocks rule) - if I in the original game added more blocks will have to repeat the process
	if(failedToAddAll){
		this.recreateGroup(0,0);
		clearMarkers(this.rects);
		this.rects = null;
		this.stoppedBlocks = null;
		this.activateEditMode();
		this.redrawFromTextGrid(text);
	}
};

////////////////////////////SPECIALS /////////////////////////


Person.prototype.scramble = function(scrambler){
	var options = []
	this.keyCodes = []
	Object.entries(selectedKeyCodes).forEach(([key, value]) => (options[options.length] = value));
	var ind;
	for (const [key, value] of Object.entries(selectedKeyCodes)) {
		if((key == "clockwise" || key == "anticlockwise" || key == "downstairs") && dontScrambleRotations)
			this.keyCodes[value] = key
		else{
			ind = Math.maybeSeededRandom(0,options.length - 1);
			var option = options.splice(ind,1);
			while(dontScrambleRotations && (selectedKeyCodes["clockwise"] ==  option || selectedKeyCodes["anticlockwise"] == option || selectedKeyCodes["downstairs"] == option)){
				ind = Math.maybeSeededRandom(0,options.length - 1);
				option = options.splice(ind,1);
			}
			this.keyCodes[option] = key;
		}
	}
	this.scrambler = scrambler;

}

Person.prototype.convertCode = function(code){
}

Person.prototype.unscramble = function(scrambler){
	
	this.keyCodes = [];
	//scrambling key codes when hit with a scramble block
	for (const [key, value] of Object.entries(selectedKeyCodes)) {
		this.keyCodes[value] = key;
	}		
	this.scrambler = null;
}

Person.prototype.setupWeapons = function(){
	this.resetWeapons();
	for(var i =0; i < this.motors.length; i+= 1){
		this.motors[i].calculateMovement();
	}
	this.findWeapons(); //A.I. uses this to work out which of it's sides are strongest
	//alert(JSON.stringify(player.dangerZones));
	
	this.fasterSpeeds = [0,0,0,0];
	for(let fan of this.fans){
		fan.updateFanSpeeds(1);
	}
}
