"use strict";
var smallThiefProb = 0.2; //probably thief will have width of 1 square
//probs for number of fans back of thief
var noFanProb = 0.1; 
var threeFanProb = 0.5;

var handyThief = false; //unused for now

Thief.prototype = new Enemy();        
Thief.prototype.constructor=Thief;

var testingDamage = false;//makes thief stop whenever near player for testing things like what happens when I am killed me/kill/damage thief

Thief.prototype.getOtherRobot = function() {
	return player;
};

function Thief(myX, myY, facing) {
	this.setup(myX, myY, facing);
}

Thief.prototype.setup = function(myX, myY, facing){
	Enemy.prototype.setup.call(this,myX, myY, facing);
	this.isThief = true;
	this.mainFace = "thiefFace";
	this.startFace = this.mainFace;
	this.makeGrid();

	//A.I. Variables
	this.preferenceForSpecials = Math.round(Math.maybeSeededRandom(5, 15));
	this.preferenceForKnives = Math.min(5,this.preferenceForSpecials - 1);
	this.missProb = Math.round(Math.maybeSeededRandom(4,15));//probability of missing a collectable when iterating through them
	this.faceAlertness = 1; //0.9
	this.chaseProb = Math.maybeSeededRandom(0, 0.3);
	this.stepSideProbabilityRun = 0.1; //much lower probability of stepping aside - will probably run instead
	this.stepSideProbabilityBlockedDecr = 0.1;//every time I'm blocked increase probability of back stepping next time
	this.stepSideProbabilityBlockedOrig = 0.5;//lower = more likely to back step
	this.stepSideProbabilityBlocked = this.stepSideProbabilityBlockedOrig;//current value
	this.awarenessDis = Math.round(Math.maybeSeededRandom(2, 5));
	this.goHomeAfterSpecialsProb = 1; //probability that will leave at any given time when all the specials have been collected
	
	this.goingHome = false;
	this.readyToMove = true;
	this.startX = myX;
	this.startY = myY;
	this.isThief = true;
	this.goingHome = false;
	this.goingHomeToStart = false;
	this.lostAKnife = false;
	this.AIcountDown = 0;
	this.hasEnteredFully = false;
	
	this.passageCleared = false;
};

Thief.prototype.die = function(explode){
	console.log("thief died");
	if(explode || this.leftGrid()){ //if I've died properly or left grid (not just restarting game) fade out last enemy heart
		intervalToNextEnemy = getEnemyInterval();
		oldEnemy.animateFadeOut();
	}
	enemy = oldEnemy;
	this.isHurt = false;
	Person.prototype.die.call(this,explode);
	this.readyToMove = false;
	player.faster = true;
	player.willResetInterval = true;

};


Thief.prototype.leaveGrid = function(){
	if(this.passageCleared)
		return;
		
	if(this.movX != 0)
		this.width = this.maxY - this.minY;
	else if(this.movY != 0)
		this.width = this.maxX - this.minX;
	clearThiefsPassage(-this.movX, -this.movY,this.myX + this.minX,this.myY + this.minY, this.width, this.minX, this.minY);
	this.passageCleared = true;
};

Thief.prototype.checkEnteredFully = function(){
	if(this.hasEnteredFully)//never retest - once it's in it's in
		return true;
	
	if(this.jumpedBack)
		return false;
	if(this.myX <= 0)
		return false;
	else if(this.myX + this.maxX >= numPiecesX)
		return false;
	else if(this.myY <= 0)
		return false;
	else if(this.myX + this.maxX >= numPiecesX) 
		return false;
	
	this.hasEnteredFully = true;
	return true;
};

Thief.prototype.intelligence = function(){
	if(testingDamage){
		if(Math.abs(this.myX - player.myX) + Math.abs(this.myY - player.myY) < 10){
			this.movX = 0;
			this.movY = 0;
			return;
		}
	}
	if(intermediate || this.partsMoving || !this.readyToMove || !this.checkEnteredFully())
		return;
	if(this.blockedByLandscape){
		var blocked = this.respondToBlockedByLandscape();
		
	}
	if(blocked || this.AIcountDown < 0){
	//		this.movX = -this.movX;
	//		this.movY = -this.movY;
	//		this.AIcountDown = 5;
	//		this.changedDir = true;
			
			var oldMovX = this.movX;
			var oldMovY = this.movY;
			
			//respond to collectables
			this.pickDirection();
			//respond to player
			var disToPlayer = this.reactToPlayer();
			if(disToPlayer == -1) //not responding to player
				this.AIcountDown = this.disToTarget * (this.alertness / (Math.maybeSeededRandom(2, 4)));
			else
				this.AIcountDown = disToPlayer;
			
			
			if(this.movX != oldMovX || this.movY != oldMovY){
				if(Math.maybeSeededRandom(0,1) < this.faceAlertness)
					this.setToFacing();
				this.changedDir = true;
			}
	}
};


Thief.prototype.collectAll = function(){
	for(var i =0; i < this.collecting.length; i += 1){
		var block = this.collecting[i];
		var x = block.myX;
		var y = block.myY;
		gameGrid[x][y].destroy(this,true);
		for(var c = 0; c < collectables.length; c += 1){
			if(collectables[c].x == x && collectables[c].y == y)
				collectables.splice(c,1);
		}
		if(block.isWeapon || block.isSpecial)
			numSpecialCols --;
	}
	this.target = null;
	this.AIcountDown = -1;
	this.collecting = [];
};

Thief.prototype.pickDirection = function(){
	//if I'm chasing him he may well run away altogether - thieves are generally cowards
	var centerX = this.myX + this.minX + ((this.maxX - this.minX) / 2);
	var centerY = this.myY + this.minY + ((this.maxY - this.minY) / 2);
	if(this.goingHome && !this.goingHomeToStart && this.lostAKnife){//if I've lost a knife I can't punch through walls
																	//so override going home
		var dis = Math.abs(this.target.centerX - centerX) + Math.abs(this.target.centerY - centerY);
		var prob = Math.min(1,(30 - dis) / 30);
		if(Math.maybeSeededRandom(0,1) < prob){
			this.target = new Target(this.startX, this.startY, 1,1);
			this.goingHomeToStart = true;
		}
	}
	if(this.target == null){
		var minDis = 100;
		var minCollect = null;
		
		if(collectables.length > 0){
			if(numSpecialCols > 0 || Math.maybeSeededRandom(0,1) > this.goHomeAfterSpecialsProb){ //high chance will go home if taken all the specials
				for(var i =0; i < collectables.length; i += 1){
					var colX = collectables[i].x;
					var colY = collectables[i].y;
					var col = gameGrid[colX][colY];
					if(col == 1){ //if collectable has disappeared from grid - this isn't supposed to happen but not a big prob - check later
						console.log("collectable mysteriously vanished"); 
						collectables.splice(i,1);
					}
					else{
						var dis = Math.abs(colX - centerX) + Math.abs(colY - centerY);
						if(col.isSpecial)
							dis = dis / this.preferenceForSpecials;
						else if(col.type == "knife")
							dis = dis / this.preferenceForKnives;
		
						if(dis < minDis){
							minDis = dis;
							minCollect = col;
						}
					}
				}
				if(minCollect != null){
					this.collectMinDis = minDis;
					this.target = minCollect;
					this.target.centerX = minCollect.myX;
					this.target.centerY = minCollect.myY;
				}
			}
		}
		if(this.target == null){//go home - not an else as may have changed if all collectables found to have disappeared

			
			//find the nearest side and head there
			var disRight = numPiecesX - (this.myX + this.maxX);
			var disLeft = this.myX + this.minX;
			var disBottom = numPiecesY - (this.myY + this.maxY);
			var disTop = this.myY + this.minY;
			if(Math.min(disTop,disBottom) < Math.min(disLeft,disRight)){
				if(disTop < disBottom)
					this.target = new Target(this.myX + (this.gridSize / 2), -this.gridSize, 1,1);
				else
					this.target = new Target(this.myX + (this.gridSize / 2), numPiecesY, 1,1);
			}else{
				if(disLeft < disRight)
					this.target = new Target(-this.gridSize, this.myY + (this.gridSize / 2), 1,1);
				else
					this.target = new Target(numPiecesX, this.myY + (this.gridSize / 2), 1,1);

			}
			
			this.goingHome = true;
		}

	}
	//probGoingHome increases after each block
	//	a few have fans on side to correct this
	//	sometimes fails at attempt to get out
	//	grabbing hand on the front but not always

};




Thief.prototype.makeGrid = function(){
	this.width = 1;
	if(Math.maybeSeededRandom(0,1) < smallThiefProb){
		var addFan = Math.maybeSeededRandom(0,1) > noFanProb;
		
		var trunkLength = Math.round(Math.maybeSeededRandom(1, 3));
		var totalLength = trunkLength + 1;
		if(addFan)
			totalLength += 1;
		var centerX = Math.floor(totalLength / 2);
		
		this.addPiece(centerX,0,"knife");
		this.totalNumBlocks = trunkLength + 1;
		var facePos = Math.round(Math.maybeSeededRandom(1, trunkLength));
		for(var i = 0; i < trunkLength; i+= 1){
			if(i + 1 == facePos)
				this.addPiece(centerX,i + 1,"heart");
			else
				this.addPiece(centerX,i + 1,"wall");
		}
		if(addFan){
			this.addPiece(centerX,trunkLength + 1,"fan");
			this.totalNumBlocks += 1;
		}
	}
	else{//bigger robot
		//2, 3 or 4 fans have equal probability. 1 has a lower probability
		var numFans = 0;
		if(Math.maybeSeededRandom(0,1) < noFanProb)
			numFans = 1;
		else if(Math.maybeSeededRandom(0,1) < threeFanProb)
			numFans = 3;
		else
			numFans = 2;
		
		if(numFans == 3)
			this.width = Math.round(Math.maybeSeededRandom(3, 4));
		else
			this.width = Math.round(Math.maybeSeededRandom(2, 4));
		
		for(var x =0; x < this.width; x+= 1)
			this.addPiece(x,0,"knife");
		for(var x =0; x < this.width; x+= 1)
			this.addPiece(x,1,"wall");
		for(var x = 0; x < this.width; x+= 1){
			if(x == 1)
				this.addPiece(x,2,"heart");
			else
				this.addPiece(x,2,"wall");
		}
		for(var x =0; x < this.width; x+= 1)
			this.addPiece(x,3,"wall");
		for(var x =0; x < numFans; x+= 1)
			this.addPiece(x,4,"fan");
		this.totalNumBlocks = this.width * 4 + numFans;
	}
	this.findWeapons();
};

Thief.prototype.lostKnife = function(block){
	this.lostAKnife = true; //so can't get out through punching a new hole
};

Thief.prototype.setRunningFace = function(running){
	if(running)
		this.resetFace("thieffaceScared");
	else
		this.resetFace(this.mainFace);

};

Thief.prototype.resetFace = function(url){
	if(url != "thieffaceScared" && url != this.mainFace)
		return;
	//so doesn't set enemy face
};
