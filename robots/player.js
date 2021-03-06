"use strict";
Player.prototype = new Person();   
Player.prototype.constructor=Player;

var edgeDetectDis = 3;//calculate landscape of adjacent grid when get this close to edge of current grid

//stair animation
var stairRotations = 5;
var stairDuration = 1024;

var scrollMargin = 10;

    
function Player(myX, myY, facing) {
	this.editBlocks = new Array();
	this.deadFace = "goodfaceDead";
	this.mainFace = "goodface";
	this.startFace = this.mainFace;
	this.hurtFace = "goodfaceHurt";
	this.stoppedPressingMotor = false;
	this.directionFaces = ["goodfaceLeft", "goodfaceUp", "goodfaceRight", "goodfaceDown"];
	if(myX != undefined)
		this.setup(myX, myY, facing);
	this.enlarged = false;
	this.willRotate = 0;
	
	//spring/motor to fire
	this.selectedMotor = null;
	this.selectedMotorInd = 0;


};

Player.prototype.recreateGroup = function(offsetX, offsetY){
	Person.prototype.recreateGroup.call(this, offsetX, offsetY);
	if(this.selectedMotor != null && selectedKeyCodes == newKeyCodes)
		canvas.setActiveObject(this.selectedMotor.image);
}

Player.prototype.stop = function(){
	this.movX = 0;
	this.movY = 0;
	this.activateEditMode();
};

//add a block by clicking on a red add square, (i.e. adding a block in edit mode)
Player.prototype.convertAddPlace = function(addPlace){
	if(this.selectedType != undefined){
		var type;
		if(playingBack)
			type = this.selectedType;
		else
			type = this.inventoryTypes[this.selectedType];
		var newX = addPlace.gridX;
		var newY = addPlace.gridY;
		this.addBlockInEdit(newX,newY,type);
		if(!playingBack){
			this.inventoryQuants[this.selectedType] -= 1;
			if(this.inventoryQuants[this.selectedType] == 0){
				this.removeFromInventory(this.selectedType);
			}
			else{
				this.recordInventoryNum(this.inventoryQuants[this.selectedType], this.selectedType);
			}
		}
		if(inPVP)
			socket.emit("rivalAddDelBlock", {rID:rivalID ,myX:newX, myY:newY, delete:false, type:type});

	}
};

//adds the block when type and location have been worked out
Player.prototype.addBlockInEdit = function(newX, newY, type){
		clearMarkers(this.rects); //clear the red add squares
		this.addPiece(newX, newY, type);
		if(newX < 0 || newY < 0){
			newX += 1;
			newY += 1;
		}

		//draw new block on canvas (not on robot group itself yet - that'll be reassembled when start moving)
		addGridSquare(newX + this.myX, newY + this.myY, type, gameGrid, canvas, null,0,0,this.grid[newX][newY].pointX,this.grid[newX][newY].pointY);
		var block = gameGrid[newX + this.myX][newY + this.myY].image;
		block.lockMovementX = true;
		block.lockMovementY = true;
		block.hasControls = false;
		block.isDeletePlace = true;
		block.origOwner = this;
		gameGrid[newX + this.myX][newY + this.myY].isDeletePlace = true;
		block.myX = newX + this.myX;
		block.myY = newY + this.myY;
		
		this.totalNumBlocks += 1;
			
		this.stoppedBlocks.push(block);
		this.addAllMarkers();//redo markers - markers go in every place adjacent to existing blocks so with new block need redoing

}

Player.prototype.deselected = function(){
	if(this.rects == undefined)
		return;
	selectedBlock = null;
	
	for(var i = 0, len = this.editBlocks.length; i < len; i+= 1)
		this.editBlocks[i].selectable = true;
	for(var i = 0, len = this.rects.length; i < len; i+= 1)
		this.rects[i].selectable = true;

};

Player.prototype.finishRotating = function(){
	this.willFinishRotating = this.group.angle;
	if(this.willFinishRotating % 90 != 0){
		this.willRotate = 0;
		this.rotation = 0;
	}
}

//rotate face back to upright if needed and not in the middle of rotation
Player.prototype.maybeRotateHeart = function(){
	if(this.willFinishRotating != -1 && !this.heartCurrentlyRotating){
		if(this.willFinishRotating != this.group.angle){ //either haven't rotated yet or already finished rotating, either way to be safe leave it til next turn to adjust
			this.heart.rotateBackAnimation();
			this.willFinishRotating = -1;
		}
		else{
			this.willFinishRotating = 999;
		}
	}
}

Player.prototype.finishEditBlockRotation = function(){	
	if(selectedBlock == null || selectedBlock.initialAngle == undefined || selectedBlock.angle == selectedBlock.initialAngle)
		return;
	
	//displaying
	selectedBlock.angle = Math.round(selectedBlock.angle / 90) * 90;
	
	//change the angle actually on my robot
	var block = this.grid[selectedBlock.myX - this.myX][selectedBlock.myY - this.myY];
	block.isDeletePlace = true;
	block.angleAdjusted = true;
	block.pointX = 0;
	block.pointY = 0;
	if(selectedBlock.angle == 0)
		block.pointX = -1;
	else if(selectedBlock.angle == 90)
		block.pointY = -1;
	else if(selectedBlock.angle == 180)
		block.pointX = 1;
	else if(selectedBlock.angle == 270)
		block.pointY = 1;


};

Player.prototype.redoSpringBlock = function(oldBlock,gameBlock){
	var newBlock = new fabric.Group(gameBlock.getImageGroup(false), {
		left: oldBlock.left,
		top: oldBlock.top,
		originX:"center",
		originY:"center"});
	//canvas.renderAll();
	canvas.remove(oldBlock);
	//canvas.renderAll();
	//canvas.add(newBlock);
	newBlock.selectable = true;
	newBlock.hasControls = false;
	return newBlock;
};

Player.prototype.deleteBlock = function(block, mustDelete, isRival, invSelected){
	var x = block.myX;
	var y = block.myY;
	
	if(!isRival){ //if same type is selected in inventory then will increment (for things like springs) -
		//info for whether this is the case either comes from which block is selected in my inventory or as a message from rival
		invSelected = this.inventoryTypes[this.selectedType] 
	}
	
	var tempBlock = this.grid[x - this.myX][y - this.myY];
	
	
	if(tempBlock.heart){
		message.set("text","Can't modify heart!");
		message.set('fill', 'red');
		tempBlock.selectable = false;
		return;//can't delete heart
	}
	if(!mustDelete && tempBlock.usePoints && canEditRotations){//will rotate - selected by selecting the same type in inventory when there is a suitable adjacent wall TODO - make special icon
		//make all the others unselectable
		selectedBlock = block;
		if(this.pointings == undefined)
			this.pointings = [];
		this.pointings[(x - this.myX) + "-" + (y - this.myY)] = this.grid[x - this.myX][y - this.myY].reversePoint + 1;

		for(var i = 0, len = this.editBlocks.length; i < len; i+= 1){
			if(this.editBlocks[i] != selectedBlock)
				this.editBlocks[i].selectable = false;
		}
		for(var i = 0, len = this.rects.length; i < len; i+= 1)
			this.rects[i].selectable = false;
		if(!isRival){
			message.set("fill", "green");
			message.set("text","World " + origSeed);
		}
		block.bringToFront();
		selectedBlock.initialAngle = selectedBlock.angle;
	}
	if(tempBlock.canAddMore){ //for items like springs where more than one block can be added to a single position
		var quantDeleted = 0;
		if(!mustDelete){
			if(invSelected == tempBlock.type){
				tempBlock.increment(1);
			}
			else{ //if have other item selected remove all and reset
				quantDeleted = tempBlock.quantity;
				tempBlock.quantity = 0;
			}

		}
		else{
			quantDeleted = 1;
			tempBlock.increment(-1);
		}
		
		if(tempBlock.quantity == 0){
			this.deleteBlock2(tempBlock, block, x, y, isRival, mustDelete);
			quantDeleted -= 1; //because 1 will already be added in deleteBlock2
		}
		else{
			var newBlock = this.redoSpringBlock(block,tempBlock);
			canvas.add(newBlock);
			this.editBlocks.push(newBlock);
			newBlock.myX = block.myX;
			newBlock.myY = block.myY;
	
			block = newBlock;
			this.stoppedBlocks.push(block);
			block.isDeletePlace = true;
			
			if(!isRival){
				selectedBlock = block;
				this.inventoryQuants[this.selectedType] -= 1;
				if(this.inventoryQuants[this.selectedType] == 0){
					this.removeFromInventory(this.selectedType);
				}
				else{
					this.recordInventoryNum(this.inventoryQuants[this.selectedType], this.selectedType);
				}
			}

		}
		if(!isRival){
			for(var i =0; i < quantDeleted; i+= 1) //in case deleted multiple copies of this block or deleted this block without called deleteBlock2 (i.e. wasn't completely removed)
				this.addBlockToInventory(tempBlock.type);
		}
	}
	else{ //not an item like a spring where multiple blocks can be added to one position
		this.deleteBlock2(tempBlock, block, x, y, isRival, mustDelete);
	
	}
	if(this.spring != null)
		this.spring.weapon = this;
	
	if(inPVP && !isRival)
		socket.emit("rivalAddDelBlock", {rID:rivalID ,myX:block.myX, myY:block.myY, delete:true, type:null, rotate:!mustDelete, invSelected});

};

//method that actually does the deleting
Player.prototype.deleteBlock2 = function(tempBlock, block, x, y, isRival, mustDelete){	
	for(var i = 0, len = this.editBlocks.length; i < len; i+= 1){
		if(this.editBlocks[i] != selectedBlock)
			this.editBlocks[i].selectable = false;
	}
	for(var i = 0, len = this.rects.length; i < len; i+= 1)
		this.rects[i].selectable = false;

	selectedBlock = null;

	var savedBlock = this.grid[x - this.myX][y - this.myY];
	this.grid[x - this.myX][y - this.myY] = null;
	if(debugMode)
		this.textGrid[x - this.myX][y - this.myY] = 0;
	this.totalNumBlocks -= 1;
	var foundGaps = false;
	if(playingBack || !mustDelete || !this.areGaps(x - this.myX,y - this.myY)){

		this.weapons.delete(this.grid[x - this.myX][y - this.myY]);

		if(tempBlock.type == "motor"){ //deleting a motor
		
			var newMots = this.motors;
			var deletedMot = false
			for(var i = 0; i < newMots.length && !deletedMot; i+= 1){
				var mot = newMots[i];
				if(mot != null && (mot.myX == (x - this.myX) && mot.myY == (y - this.myY))){//found the motor that we want to delete
					newMots.splice(i,1);
					deletedMot = true;
				}
			}
			if(!deletedMot){
				//TODO figure out how to handle properly
				alert("motor to be deleted not found");
			}
			this.motors = newMots
		}
		else if(tempBlock.type == "fan")
			this.fans.delete(savedBlock)
		
		
		clearMarkers(this.rects);
		canvas.remove(block);
		gameGrid[x][y] = 1;
		this.addAllMarkers();
		if(!isRival)
			this.addBlockToInventory(tempBlock.type);
	}
	else{//if it would leave a gap = can't remove replace block
		foundGaps = true;
		this.grid[x - this.myX][y - this.myY] = tempBlock;
		this.totalNumBlocks += 1;
	}
	//reset gap checking
	for(var ix = 0; ix < this.gridSize; ix += 1){
		for(var iy = 0; iy < this.gridSize; iy += 1){
			if(this.grid[ix] != undefined && this.grid[ix][iy] != undefined && this.grid[ix][iy] != null)
				this.grid[ix][iy].checkedForGaps = false;
		}
	}



};


Player.prototype.checkCollision = function() {
	if(Person.prototype.checkCollision.call(this)) //if jumped back
		return true;
	//highlight stairs red when over them
	if(this.stairsCollide != null && activatedStairs == null){
		activatedStairs = this.stairsCollide;
		var background = new fabric.Rect({
			  left: activatedStairs.x * gridWidth,
			  top: activatedStairs.y * gridHeight,
			  fill: 'yellow',
			  width: gridWidth * 2,
			  height: gridHeight * 2,
			});	
		canvas.add(background);
		activatedStairs.background = background;
		this.group.bringToFront();
		activatedStairs.image.moveTo(-1);
		background.moveTo(-2);
		canvas._objects[canvas._objects.length - 1].selectable = false;

	}
	else if(this.stairsCollide == null && activatedStairs != null){
		canvas.remove(activatedStairs.background);
		activatedStairs = null;
	}
	
	return false;
};


Player.prototype.hasWeaponInInventory = function(){
	for(var i =0; i < this.inventoryTypes.length; i += 1){
		if(this.inventoryTypes[i] != "block")
			return true;
	}
}

Player.prototype.addBlockToInventory = function(type){
	var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
	var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

	
	var ind = -1;
	for(var i =0; i < this.inventoryTypes.length && ind == -1; i += 1){
		if(this.inventoryTypes[i] === type)
			ind = i;
	}
	if(ind == -1){
		//pointOffset and offset- see above
		var img = null;
		if(type == "spring"){
			img = getBasicSpringGroup();
			img.left = ((this.inventoryTypes.length + 0.5) * gridWidth) + scrollLeft;
			img.top = (gridHeight * 0.5) + scrollTop;
		}
		else{
			img = new fabric.Image(document.getElementById(type), {
				left: ((this.inventoryTypes.length + 0.5) * gridWidth) + scrollLeft,
				top: (gridHeight * 0.5) + scrollTop,
				width: gridWidth,
				height: gridHeight
			});
		}
		
		img.borderColor = 'yellow';
		img.strokeWidth = 5;

		img.inventory = this.inventoryTypes.length;
		img.selectable = true;
		canvas.add(img);
		img.lockScalingX = img.lockScalingY = img.lockMovementX = img.lockMovementY = true;
		img.hasControls = false;
		img.setCoords();
		ind = this.inventoryTypes.length;
		this.recordInventoryNum(1, ind);
		this.inventoryImages.push(img);
		this.inventoryTypes.push(type);
		this.inventoryQuants.push(1);
		
		//reset del image to end of inventory
		delImg.left = ((this.inventoryTypes.length + 1.5) * gridWidth) + scrollLeft;
		delImg.top = (gridHeight * 0.5) + scrollTop;
		delImg.setCoords();
	}
	else{
		this.inventoryQuants[ind] += 1;
		this.recordInventoryNum(this.inventoryQuants[ind], ind);
	}
};

Player.prototype.removeFromInventory = function(index){
	
	canvas.remove(this.inventoryText[index]);
	canvas.remove(this.inventoryImages[index]);
	for(var i = index; i < this.inventoryTypes.length - 1; i += 1){
		this.inventoryImages[i] = this.inventoryImages[i + 1];
		this.inventoryTypes[i] = this.inventoryTypes[i + 1];
		this.inventoryQuants[i] = this.inventoryQuants[i + 1]
		this.inventoryText[i] = this.inventoryText[i + 1];
		this.inventoryText[i].left -= gridWidth;
		this.inventoryImages[i].left -= gridWidth;
		this.inventoryImages[i].inventory -= 1;
		this.inventoryImages[i].setCoords(); 		
		
		

	}
	this.inventoryImages.pop();              		
	this.inventoryTypes.pop();               		
	this.inventoryQuants.pop();
	this.inventoryText.pop();
	this.selectedType = undefined;
	
	//reset del image to end of inventory
	delImg.left = ((this.inventoryTypes.length + 1.5) * gridWidth) + (window.pageXOffset || document.documentElement.scrollLeft);
	delImg.top = (gridHeight * 0.5) + (window.pageYOffset || document.documentElement.scrollTop);
	delImg.setCoords();
};

Player.prototype.recordInventoryNum = function(num, ind){
	var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
	var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

	if(this.inventoryText == undefined || this.inventoryText == null)
		this.inventoryText = [];
	
	if(ind < this.inventoryText.length){
		this.inventoryText[ind].set("text", "" + num);
	}
	else{
		//TODO THHHIIISSS is where inventory text position is set!!!!
		var text = new fabric.Text("" + num, 
				{ left: (gridWidth * (ind + 1)) + scrollLeft - 10, 
			top: (gridHeight * 2) - 10 + scrollTop, 
			fontSize: 20,
			stroke: 'white' });
		this.inventoryText.push(text);
		canvas.add(text);
		text.selectable = false;
	}
};

Player.prototype.selectFromInventory = function(index){
	this.selectedType = index;
};

Player.prototype.updateGrid = function(clear){
	if(!(this.rects != undefined && this.rects != null)) //if I'm not in edit mode
		Person.prototype.updateGrid.call(this,clear);
};

Player.prototype.setupWeapons = function(){
	Person.prototype.setupWeapons.call(this);
	if(this.selectedMotor == null){
		this.changeSelectedMotor(0);
	}
		

}

Player.prototype.changeSelectedMotor = function(incr){
	this.selectedMotor = null;
	var i = 0;
	while((this.selectedMotor == null || !this.selectedMotor.isWorking()) && i < this.motors.length){
		this.selectedMotorInd += incr;
		if(this.selectedMotorInd == -1)
			this.selectedMotorInd = this.motors.length -1;
		else if(this.selectedMotorInd == this.motors.length)
			this.selectedMotorInd = 0;
		this.selectedMotor = this.motors[this.selectedMotorInd];
		i++;
	}
	if(this.selectedMotor != null)
		canvas.setActiveObject(this.selectedMotor.image);
}

//will attempt to reselect inventory item I had selected before but, if it's not available will just select last item in inventory
//if none available will select delImg
Player.prototype.tryToSelectWhatIHadSelectedBefore = function(lastSelectedInd){
	if(this.inventoryImages.length == 0)
		return delImg;
	
	while(lastSelectedInd >= this.inventoryImages.length)
		lastSelectedInd -= 1;
	return this.inventoryImages[lastSelectedInd];
}

Player.prototype.activateEditMode = function(){
	this.recreateable = false;
	this.damagedBlocks = new Array();

	if(this != enemy){ //don't do the stuff connected to actual editing if this is the rival in PVP
		canvas.setActiveObject(delImg);
		//add the delete icon to the inventory
		delImg.left = ((this.inventoryTypes.length + 1.5) * gridWidth) + (window.pageXOffset || document.documentElement.scrollLeft);
		delImg.top = (gridHeight * 0.5) + (window.pageYOffset || document.documentElement.scrollTop);
		delImg.setCoords();
		canvas.add(delImg);


		for(var i =0, len = this.inventoryImages.length; i < len; i+= 1){
			this.inventoryImages[i].setCoords();
			this.inventoryImages[i].bringToFront();
			this.inventoryImages[i].selectable = true;
		}
	}
	
	canvas.remove(this.group);
	this.stoppedBlocks = new Array();
	var heart = null;
	selectedBlock = null;
	this.editBlocks = new Array();
	//transfer my blocks from part of me to individual entities on the game grid (allows clicking and deleting them)
	for(var x = 0; x < this.gridSize; x+= 1){
		for(var y = 0; y < this.gridSize; y+= 1){
			if(this.grid[x][y] != null){
				addGridSquare(x + this.myX, y + this.myY, this.grid[x][y].type, gameGrid, canvas, null,0,0,this.grid[x][y].pointX,this.grid[x][y].pointY);
				if(this.grid[x][y].quantity != undefined && this.grid[x][y].quantity > 1){
					gameGrid[x + this.myX][y + this.myY].quantity = this.grid[x][y].quantity;
					this.redoSpringBlock(gameGrid[x + this.myX][y + this.myY].image,gameGrid[x + this.myX][y + this.myY]);
				}
				//setting to same angle etc as existing block.
				if(gameGrid[x + this.myX][y + this.myY].usePoints){
					gameGrid[x + this.myX][y + this.myY].pointX = this.grid[x][y].pointX;
					gameGrid[x + this.myX][y + this.myY].pointY = this.grid[x][y].pointY;
					gameGrid[x + this.myX][y + this.myY].getPoints();
					gameGrid[x + this.myX][y + this.myY].redraw(true);
				}
				//end of resettings
				gameGrid[x + this.myX][y + this.myY].isDeletePlace = true;
				gameGrid[x + this.myX][y + this.myY].origOwner = this;

				
				if(gameGrid[x + this.myX][y + this.myY].type == "heart")
					heart = gameGrid[x + this.myX][y + this.myY];
				
				var block = gameGrid[x + this.myX][y + this.myY].image;
				this.stoppedBlocks.push(block);
				block.lockMovementX = true;
				block.lockMovementY = true;
				block.lockScalingX = true;
				block.lockScalingY = true;
				this.editBlocks.push(block);
				if(this.grid[x][y].usePoints){
					 	//only rotation allowed
					    block.setControlsVisibility({
					          mt: false, 
					          mb: false, 
					          ml: false, 
					          mr: false, 
					          bl: false,
					          br: false, 
					          tl: false, 
					          tr: false,
					          mtr: true, 
					     });
				}
				else{
					block.lockRotation = false;
					block.hasControls = false;
				}
				block.isDeletePlace = true;
				block.origOwner = this;
				block.myX = x + this.myX;
				block.myY = y + this.myY;
				
				if(this == enemy) //can't edit if this is rival in PVP
					block.selectable = false;

			}
			
			
			
			
			
		}
	}
	heart.image.bringToFront();
	this.addAllMarkers();
	this.recheckedGaps = false;
};

Player.prototype.addAllMarkers = function(){
	this.rects = new Array();

	//add places I can add blocks in every space adjacent to existing block
	for(var x = 0; x < this.gridSize; x += 1){
		for(var y =0; y < this.gridSize; y += 1){
			if(this.grid[x][y] != null && this.grid[x][y] != undefined){
				if(x == 0 || this.grid[x - 1][y] == undefined || this.grid[x - 1][y] == null)
					this.addMarker(x - 1,y);
				if(y == 0 || this.grid[x][y - 1] == undefined || this.grid[x][y - 1] == null)
					this.addMarker(x,y - 1);
				if(x == this.gridSize - 1 || this.grid[x + 1][y] == undefined || this.grid[x + 1][y] == null)
					this.addMarker(x + 1,y);
				if(y == this.gridSize - 1 || this.grid[x][y + 1] == undefined || this.grid[x][y + 1] == null)
					this.addMarker(x,y + 1);
			}
				
		}
	}
};

function clearMarkers(markers){
	for(var i =0; i < markers.length; i+=1){
		canvas.remove(markers[i]);
		gameGrid[markers[i].left / gridWidth][markers[i].top / gridHeight] = 1;
	}
}

Player.prototype.scrollInventory = function(absolute){
	//reposition inventory so always at top
	if(absolute){
		var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
		var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
		
		for(var i = 0; i < this.inventoryText.length; i+= 1){
			this.inventoryText[i].left = ((i + 1) * gridWidth) - 10 + scrollLeft;
			this.inventoryText[i].top = (gridHeight * 2) - 10 + scrollTop;
			this.inventoryImages[i].left = scrollLeft + ((i + 0.5) * gridWidth);
			this.inventoryImages[i].top = (gridHeight * 0.5) + scrollTop;
			this.inventoryImages[i].setCoords();
		}
		invBackground.left = scrollLeft;
		invBackground.top = scrollTop;
		
		message.left = scrollLeft + (displayWidth/2);
		message.top = scrollTop + 30;
		if(socket != null && curRival != null){
			curRival.left = scrollLeft + (document.documentElement.clientWidth - curRival.width - rivalIconMargin);
			curRival.top = scrollTop + rivalIconMargin;
			curRival.setCoords();
		}
		
	}
	else{
		for(var i = 0; i < this.inventoryText.length; i+= 1){
			this.inventoryText[i].left += scrollingX;
			this.inventoryText[i].top += scrollingY;
			this.inventoryImages[i].left += scrollingX;
			this.inventoryImages[i].top += scrollingY;
		}
		invBackground.left += scrollingX;
		invBackground.top += scrollingY;
		
		message.left += scrollingX;
		message.top += scrollingY;
		
		if(usingSocket && curRival != undefined && curRival != null){
			curRival.left += scrollingX;
			curRival.top += scrollingY;
			curRival.setCoords();
		}
	}
};
//marker is a translucent red square indicating a place where a block can be added in edit mode
Player.prototype.addMarker = function(x, y) {
	if(gameGrid[this.myX + x][this.myY + y] != 1) //don't add markers off the screen
		return;

	var addColour = 'blue'
	if(this == enemy)
		addColour = 'yellow'
	
	// create a rectangle object
	var rect = new fabric.Rect({
	  left: (this.myX + x) * gridWidth,
	  top: (this.myY + y) * gridHeight,
	  fill: addColour,
	  width: gridWidth,
	  height: gridHeight,
	  opacity: 0.2,
	  gridX: x,
	  gridY: y,
	  isAddPlace: true
	});	
	gameGrid[this.myX + x][this.myY + y] = rect;
	
	rect.lockScalingX = true;
	rect.lockScalingY = true;
	rect.lockMovementX = true;
	rect.lockMovementY = true;
	rect.hasControls = false;
	this.rects.push(rect);
	
	if(this == enemy)
		rect.selectable = false;
	
	canvas.add(rect);

};

Player.prototype.collectAll = function() {
	Person.prototype.collectAll.call(this);
	this.updateRivals();
};

Player.prototype.updateRivals = function(){
	if(usingSocket)
		socket.emit('playerShapeChanged', {gr:getStringArray(this.grid),uID:uniqueID});
}

Player.prototype.isEditing = function(){
	return (this.rects != undefined && this.rects != null);
}

Player.prototype.leaveEditing = function(){
	canvas.setActiveObject(delImg); //deselect currently selected (until I figure out how to do it properly)
	this.recreateable = true;
	this.pointings = undefined;
	this.shrink();
	clearMarkers(this.rects);
	for(var i =0; i < this.damagedBlocks.length; i+=1)
		canvas.remove(this.damagedBlocks[i]);
	for(var i =0; i < this.editBlocks.length; i+= 1)
		canvas.remove(this.editBlocks[i]);
	this.rects = null;
	this.stoppedBlocks = null;
	for(var i =0, len = this.inventoryImages.length; i < len; i+= 1){
		this.inventoryImages[i].selectable = false;
	}
	canvas.remove(delImg);
	this.setupWeapons();
	this.updateRivals();
}



Player.prototype.setMovement = function(x, y) {
	if(x != 0 && (this.myY + this.minY < 0 || this.myY + this.maxY >= numPiecesY)) //moving sideways while hanging off top or bottom of grid not allowed as messes up into/out of patterns
		return;
	if(y != 0 && (this.myX + this.minX < 0 || this.myX + this.maxX >= numPiecesX)) //moving sideways while hanging off top or bottom of grid not allowed as messes up into/out of patterns
		return;
	if(this.isEditing()){//I'm just resuming movement after being in edit mode
		this.leaveEditing();
	}
	if(this.willRotate != 0){
		if(this.movepartsSpeed > 1){//don't rotate when moving slider
			this.rotation = 0;
			this.willRotate = 0;
			this.changedDir = false;
			return;
		}
		else{
			this.rotateAndExtract();
		}
	}
	if(this.willMoveX != undefined){
		this.movX = x;
		this.movY = y;
	}
	this.changedDir = true;
};

Player.prototype.saveTextGrid = function() {
	console.log(timeStamp + ":addpiece" + this.textGrid.length + "s" + this.textGrid + "game"); //s is size
};





Player.prototype.rotate = function(){
	var wasEnlarged = this.enlarged;
	if(wasEnlarged)//correct size grid before rotating
			Player.prototype.shrinkGrid();
	Person.prototype.rotate.call(this);
	if(wasEnlarged)//???
		Player.prototype.activateEditMode();
};

Player.prototype.willSetMovement = function(movX, movY,creep){
	if(this.rects != undefined && this.rects != null)//I'm just resuming movement after being in edit mode
		this.justLeftEditMode = true;
	this.willMoveX = movX;
	this.willMoveY = movY;
	//this.creep = creep;
};


Player.prototype.update = function(){
	if(this != enemy){ //if it's the rival in PVP (i.e. not directly controlled by this player) don't scroll to it and do the stuff related to it leaving the grid
		if((this.myX + this.minX < -1 || this.myX + this.maxX > numPiecesX ||  this.myY + this.minY < -1 || this.myY + this.maxY  > numPiecesY) && this.blockedByLandscape){
			message.set("fill", "red")
			message.set("text", "Route blocked by stone! Back up!");
		}
		this.possiblyUpdateBlind();	
		this.adjustScroll();
		if(willRestart != null){ 
			this.restart(); //if I left last turn and enemy killed itself, resetting timers
			willRestart = null;
		}
		else{
			this.possiblyLeaveGrid();//check entered next landscape or close enough to at least generate next landscape
			if(willRestart != null){
				allComplete() //wait for enemy to kill itself next turn, there is nothing I can do now
				return;
			}
		}
	}

		
	if(enemy.justReadyToMove){
		if(this.overEnemy()){
			this.extractionRetries = 1000;
			this.willRotate = (Math.round(Math.maybeSeededRandom(0,1)) * 2) - 1;
		}
		else{
			this.extractionRetries = 5;
			enemy.justReadyToMove = false;
		}
	}
	Person.prototype.update.call(this);
};

Player.prototype.overEnemy = function(){

	for(var x = this.minX; x <= this.maxX; x += 1){
		for(var y = this.minY; y <= this.maxY; y += 1){
			if(this.grid[x][y] != null && this.grid[x][y] != 0)
				if(this.grid[x] != undefined && x + this.myX >= 0 && x + this.myX < numPiecesX && y + this.myY >= 0 && y + this.myY < numPiecesY && this.grid[x][y] != undefined && this.grid[x][y] != null){
					if(gameGrid[x + this.myX][y + this.myY] != undefined && gameGrid[x + this.myX][y + this.myY] != null && gameGrid[x + this.myX][y + this.myY] != 1 && gameGrid[x + this.myX][y + this.myY].owner == enemy)
						return true;
				}
		}
	}

}

Player.prototype.tryToChangeDir = function(){
	if((this.willMoveX != undefined || this.willRotate != 0)&& !intermediate && !this.partsMoving){
		this.setMovement(this.willMoveX, this.willMoveY);
		this.willMoveX = undefined;
	}
};

Player.prototype.possiblyLeaveGrid = function(){
	
	//getting close
	if(this.myX + this.maxX >= numPiecesX - edgeDetectDis){//getting close to right
		rightGrid = generateNextGrid(rightGrid, seedJumpX);
	}
	else if(this.myX + this.minX < edgeDetectDis){//getting close to left
		leftGrid = generateNextGrid(leftGrid, -seedJumpX);

	}
	
	if(this.myY + this.maxY >= numPiecesY - edgeDetectDis){//getting close to bottom
		bottomGrid = generateNextGrid(bottomGrid, seedJumpY);
	}
	else if(this.myY + this.minY < edgeDetectDis){//getting close to top
		topGrid = generateNextGrid(topGrid, -seedJumpY);
	}	
	
	//leaving
	if(this.myX + this.minX == numPiecesX && this.movX == 1) //heading out right
		willRestart = "right";
	else if(this.myX + this.maxX == -1 && this.movX == -1) //left
		willRestart = "left";
	else if(this.myY + this.minY == numPiecesY && this.movY == 1) //heading out bottom
		willRestart = "bottom";
	else if(this.myY + this.maxY == -1 && this.movY == -1) //top 
		willRestart = "top";

};

//if just moved from one landscape to another how far down side do I appear?
//HEIGHT = length of side entering so if entering left/right will be height - if entering top/bottom will be WIDTH
//WIDTH = adjacent side to height
function newXYForNeighbour(neighLand,myXY, myHeight, curHeight,neighHeight,neighWidth,seekHoles,side){
	//height of new land/height of old
	var ratio = neighHeight / curHeight;
	//find equivalent place on new land side or near bottom of new land if its too short for that
	var pos = Math.min(neighHeight - myHeight,Math.round(myXY * ratio));

	if(neighHeight < curHeight || !seekHoles)
		return Math.round(pos);
	else{//seekHoles for now always true(?) - it ensures when return to old landscape will always go through hole already created rather than having to break new one
		var grid = neighLand.grid;
		var x;
		var y;
		if(side == "left") //side I'm checking on the neighbour (opposite side to what I'm leaving)
			x = 0;
		else if(side == "right")
			x = neighWidth - 1;
		else if(side == "top")
			y = 0;
		else if(side == "bottom")
			y = neighWidth - 1;
		
		var start = Math.floor(pos);
		var end = Math.ceil(pos);
		
		//find largest gap
		var maxGap = 0;
		var count = 0;
		var startGap;
		var endGap;
		for(var i = start; i < end; i += 1){
			if ( ((side == "left" || side == "right") && grid[x][i] == 1)
					||
				 ((side == "top" || side == "bottom") && grid[i][y] == 1)){
				if(tempStartGap == -1)
					tempStartGap = y;
				count += 1;
			}
			else{
				if(count > maxGap){
					maxGap = count;
					endGap = i - 1;
					startGap = tempStartGap;
				}
				count = 0;
				tempStartGap = -1;
			}
		}
		if(count > 0){//reached bottom but not reached end of gap
			if(count > maxGap){
				endGap = end;
				startGap = tempStartGap;
			}
		}
		
		if(startGap == undefined) //no gaps
			return pos;
		return Math.floor(Math.seededRandomDouble(startGap, endGap - myHeight));
	}
}

Player.prototype.respondToDamage = function(){
	Person.prototype.respondToDamage.call(this);
	this.resetFace("goodfaceHurt");
	this.isHurt = true;
	if(this.rects != undefined && this.rects != null){//if damaged while editing redo markers
		clearMarkers(this.rects);
		this.addAllMarkers();
	}
	this.updateRivals();
};

//spinning motion going down stairs
Player.prototype.animateDownStairs = function() {
	
	animating = true;
		this.group.animate('angle', makeAnimateString(360 * stairRotations), {
	          onComplete: function(){
	          	goDownStairs();
	          },
	       duration: stairDuration
			});
		this.group.animate('scaleX', 0.1, {
				duration: stairDuration
			});
		
		this.group.animate('scaleY', 0.1, {
				duration: stairDuration
			});
		
		this.group.animate('left', ((activatedStairs.x + 1) * gridWidth), {
				duration: stairDuration
			});
		
		this.group.animate('top', ((activatedStairs.y + 1) * gridHeight), {
				duration: stairDuration
			});
};

//spinning motion going down stairs
Player.prototype.animateToRival = function(m) {
	
	animating = true;
		this.group.animate('angle', makeAnimateString(360 * stairRotations), {
		  msg: m,
		  onChange: canvas.renderAll.bind(canvas),
	          onComplete: function(){
	          	moveToRival2(this.msg);
	          },
	       duration: stairDuration
			});
		this.group.animate('scaleX', '0.7', {
				duration: stairDuration
			});
		
		this.group.animate('scaleY', '0.7', {
				duration: stairDuration
			});
		
		this.group.animate('left', makeAnimateString(curRival.left - this.group.left + (this.actualWidth / 2)), {
				duration: stairDuration
			});
		
		this.group.animate('top', makeAnimateString(curRival.top - this.group.top + (this.actualHeight / 2)), {
				duration: stairDuration
			});
};

Player.prototype.animateOutOfCorner = function(nextMethod) {
	this.group.opacity = 0.5;
	animating = true;
		this.group.animate('angle', makeAnimateString(360 * stairRotations), {
		onChange: canvas.renderAll.bind(canvas),
	          onComplete: function(){
	          	nextMethod();
	          },
	       duration: stairDuration
			});
		this.group.animate('scaleX', '1.0', {
				duration: stairDuration
			});
		
		this.group.animate('scaleY', '1.0', {
				duration: stairDuration
			});
		this.group.animate('opacity', '1.0', {
				duration: stairDuration
			});
		
		this.group.animate('left', makeAnimateString((this.myX * gridWidth) - this.group.left + (this.actualWidth / 2)), {
				duration: stairDuration
			});
		
		this.group.animate('top', makeAnimateString((this.myY * gridHeight) - this.group.top + (this.actualHeight / 2)), {
				duration: stairDuration
			});
};


Player.prototype.getOtherRobot = function() {
	return enemy;
};

Player.prototype.emergeFromStairs = function(stairs){
	this.myX = stairs.x + 1 - Math.round((this.maxX - this.minX)/2) - this.minX;
	this.myY = stairs.y + 1 - Math.round((this.maxY - this.minY)/2) - this.minY;
	this.movX = 0;
	this.movY = 0;
	if(this.extractFromOverlap(20)){//didn't manage to get out of corner last time (i.e. randomly picking directions to get away didn't work)
		this.emergeFromStairs(stairs);//try again
	}
	else{
		//draw in middle of stairs
		this.group.left = (stairs.x + 1) * gridWidth;
		this.group.top = (stairs.y + 1) * gridHeight;
		
		var newX = (this.myX * gridWidth) + ((this.gridSize * gridWidth) / 2);
		var newY = (this.myY * gridHeight) + ((this.gridSize * gridHeight) / 2);
	
		canvas.add(this.group);
		
		//spinning motion going up stairs
		this.group.animate('angle', makeAnimateString(360 * stairRotations), {
	        onComplete: function(){
	        	willGoDownStairs = false;
	        	updateGame();
	        },
	     duration: stairDuration
			});
		this.group.animate('scaleX', 1, {
				duration: stairDuration
			});
		
		this.group.animate('scaleY', 1, {
				duration: stairDuration
			});
		
		this.group.animate('left', newX, {
				onChange: scrollToPlayer(),
				duration: stairDuration
			});
		
		this.group.animate('top', newY, {
				duration: stairDuration
			});
	}
};

Player.prototype.adjustScroll = function() {
	var windowLeft = window.pageXOffset || document.documentElement.scrollLeft;
	var windowTop = window.pageYOffset || document.documentElement.scrollTop;
	var offTop = this.group.top - windowTop < (scrollMargin * gridHeight);
	var offBottom = this.group.top + this.group.height - windowTop > (clientHeight - (scrollMargin * gridHeight));
	
	var offLeft = this.group.left - windowLeft < (scrollMargin * gridWidth);
	var offRight = this.group.left + this.group.width - windowLeft > (clientWidth - (scrollMargin * gridWidth));
	var speedUp = (scrollDelay / initialInterval) * gridWidth * this.fastSpeed_fixed * scrollSpeedup;
	
	
	if(this.collided || this.partsMoving){
		scrollingX = 0;
		scrollingY = 0;
	}
	else if(this.movX == 1 && windowLeft < maxScrollX && offRight){
		if(scrollingX == 0){
			scrollingX = speedUp;
			scrollLoop();
		}
	}
	else if(this.movX == -1 && windowLeft > canvas._offset.left && offLeft){
		if(scrollingX == 0){
			scrollingX = -speedUp;
			scrollLoop();
		}
	}
	else if(this.movY == 1 && windowTop < maxScrollY && offBottom){
		if(scrollingY == 0){
			scrollingY = speedUp;
			scrollLoop();
		}
	}
	else if(this.movY == -1 && windowTop > canvas._offset.top && offTop){
		if(scrollingY == 0){
			scrollingY = -speedUp;
			scrollLoop();
		}
	}
	
	if(!((scrollingX > 0 && this.movX == 1) || (scrollingX < 0 && this.movX == -1)) || (scrollingX > 0 && offLeft) || (scrollingX < 0 && offRight))
		scrollingX = 0;
	if(!((scrollingY > 0 && this.movY == 1) || (scrollingY < 0 && this.movY == -1))  || (scrollingY > 0 && offTop) || (scrollingY < 0 && offBottom))
		scrollingY = 0;


};

///////////////////////////SPECIALS/////////////////////////////////////

Player.prototype.scramble = function(scrambler){
	this.resetFace("goodfaceConfused", true);
	this.recreateGroup();
	message.set("fill","purple");
	message.set("text","Steal his scrambler to unscramble yourself!");
	Person.prototype.scramble.call(this, scrambler);

}

Player.prototype.unscramble = function(scrambler){
	Person.prototype.unscramble.call(this, scrambler);
	message.set("text","Unscrambling complete");
	this.resetFace("goodface");
	this.recreateGroup();
}

Player.prototype.convertCode = function(code){
	if(this.keyCodes[code] == undefined)
		return code;
	return this.keyCodes[code];
}

Player.prototype.possiblyUpdateBlind = function(code){
	if(this.blinder == undefined || this.blinder == null)
		return;
	if(Math.maybeSeededRandom(0,1) < (this.blindedCounter / (blindedCounterMax))){
		this.blinder.addCircle(Math.maybeSeededRandom(0, displayWidth), Math.maybeSeededRandom(0, displayHeight), Math.maybeSeededRandom(10,200), true)
		message.bringToFront();
	}
	if(this.blinder.numBubbles == 0){
		this.blinder.loseEffect();
		this.blinder = null;
		this.resetFace("goodface");
	}

	
	this.blindedCounter --;
}

Player.prototype.blind = function(blinder){
	this.blinder = blinder;
	message.set("fill","black");
	message.set("text","You've been blinded!");
	blinder.fillWithBubbles();
	message.bringToFront();
	this.blindedCounter = Math.maybeSeededRandom(blindedCounterMin, blindedCounterMax);
	this.resetFace("goodfaceBlind",true);
	this.recreateGroup();

}

Player.prototype.stairCollisions = function(minX, minY, maxX, maxY){
	for(let stairs in land.stairs){
		if(minX < stairs.x  + 2 && maxX >= stairs.x &&
				minY < stairs.y  + 2 && maxY >= stairs.y)
			this.stairsCollide = stairs;
	}

}

//if removing this block will leave a gap (this block is a bridge)
Player.prototype.areGaps = function(x,y){
	var areGaps = Person.prototype.areGaps.call(this, x, y);
	
	//shouldn't be necessary but for some reason totalNumBlocks sometimes decides to go wrong
	//so I have to add in this recheck
	if(areGaps && this.isEditing() && !this.recheckedGaps){
		//get totalNumBlocks
		var oldTot = this.totalNumBlocks;
		this.totalNumBlocks = 0;
		for(var x = 0; x < this.gridSize; x++){
			if(this.grid[x] != undefined){
				for(var y = 0; y < this.gridSize; y++){
					if(this.grid[x][y] != undefined && this.grid[x][y] != null)
						this.totalNumBlocks++;
				}
			}
		}
		if(this.totalNumBlocks != oldTot){ //try again with new block number
			areGaps = Person.prototype.areGaps.call(this, x, y);
			console.error("something went wrong with areGaps(...) - totNumBlocks inconsistent"); //this is a buggy situation - totNumBlocks should update automatically - might have to fix later
		}
		this.recheckedGaps = true;
	}
	
	return areGaps;
};

