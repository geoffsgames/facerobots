document.body.style.overflow = 'hidden'; //prevent scrolling

var canvasBG = document.getElementById('canvasBG');
var context = canvasBG.getContext('2d');



var canvas = new fabric.Canvas("canvas");

//editing settings
canvas.controlsAboveOverlay = true;

var character;

//character speed
var initialInterval = 256;
var minInt = 16;
var maxSpeed = initialInterval / minInt;
var numSpeeds = (Math.log(maxSpeed) / Math.log(2));

var selectedBlock = null;
var stoppedPressingMotor = false;

var interval = initialInterval;
var oldInterval = interval;

var lastTime = 0;
var lastKey = 0;

var clientWidth = document.documentElement.clientWidth;
var clientHeight = document.documentElement.clientHeight;

var displayWidth, displayHeight; //size of the whole current landscape 
var maxScrollX, maxScrollY;

//number of squares across/down can be displayed on screen at once
var gridWidth = clientWidth / 40;
if(Math.abs(gridWidth - 16) < Math.abs(gridWidth - 32))
	gridWidth = 16;
else
	gridWidth = 32;
var gridHeight = gridWidth;
var numPiecesScreenX = Math.ceil(clientWidth / gridWidth);
var numPiecesScreenY = Math.ceil(clientHeight / gridHeight);
var code;
var invBackground;
var scrollSpeedup = 2;

var canEditRotations = false;
var dt = new Date();
var scrollDelay = 16;

var waitingForRotate = false; //before non intermediate has been confirmed, don't do anything once non intermediate confirmed
var reallyWaitingForRotate = false; //after non intermediate has been confirmed, do nothing

var startTime = 0;

var delImg = new fabric.Image(document.getElementById("delete"), {
	width: gridWidth,
	height: gridHeight,
	lockScalingX: false,
	lockScalingY: false,
	lockMovementX: false,
	lockMovementY: false,
	hasControls: false,
	offsetX: "left",
	offsetY: "top",
	borderColor: 'yellow',
	strokeWidth: 5

});
var deleting = false;
var lastSelectedBlock = null;

var message = new fabric.Text("Face Robots!", {
	left: displayWidth/2,
	top: 30,
	fontSize: 40,
	fontFamily: 'Arial',
	fontWeight: 'bold',
	originX: 'center',
	originY: 'center',
	stroke: '#black',
	strokeWidth: 2
});

message.setColor('green');

//used to guide landscape in creating player spawn site
var playerStartSize = 5;

var countLag = 0;

document.onkeydown = keyListener;

function initCanvas(){
	canvas.setWidth(numPiecesX * gridWidth);
	canvas.setHeight(numPiecesY * gridHeight);
	canvas.calcOffset();
	canvasBG.width  = numPiecesX * gridWidth + (canvas._offset.left * 2); // in pixels
	canvasBG.height = numPiecesY * gridHeight + (canvas._offset.top * 2);
	canvasBG.style.left = "-" + canvas._offset.left + "px";
	canvasBG.style.top = "-" + canvas._offset.top + "px";
	var img=document.getElementById("grass");
    context.drawImage(img,0,0);
	//context.fillStyle = "#DAF7A6";
	//context.fillRect(0,0,numPiecesX * gridWidth,numPiecesY * gridHeight);
}



function changeState(code,doubleclick){
	//http://keycode.info/

	code = player.convertCode(code);
    if(code== "left"){
        //keyCode 37 is left arrow
        player.willSetMovement(-1,0,doubleclick);
    }
    else if(code== "right"){
        //keyCode 39 is right arrow
        player.willSetMovement(1,0,doubleclick);
    }
    else if(code== "up"){
        //keyCode 38 is up arrow
    	player.willSetMovement(0,-1,doubleclick);
    }
    else if(code== "down"){
        //keyCode 40 is down arrow
    	player.willSetMovement(0,1,doubleclick);
    }
    else if(code == "anticlockwise"){
    	//shift
    	if(player.willFinishRotating == -1)
    		player.willRotate = -1;//anti-clockwise
    }
    else if(code == "clockwise"){//backspace
    	if(selectedBlock != null)
    		player.deleteBlock(selectedBlock, true); 
    }
    else if(code== 68){//d - down stairs
    	if(activatedStairs != null)
    		willGoDownStairs = true;
    }
    else if(code == 32){ //space
    	if(player.movX != 0 || player.movY != 0)
    		player.willStop = true;
    }
    else if(code == 83){ //'s' key = stop replay
    	//TODO - stick this here for now
    	alert(countLag);
    	saving = false;
    }
    else if(code >= 49 && code <= 58){ //numbers
		stoppedPressingMotor = false;
    	player.motorWillStart = code - 49;
    }
    else if(code==13){
    	//enter
    	if(player.willFinishRotating == -1)
    		player.willRotate =1;//clockwise
    }
    else if(code==82){//r
		alert("Restarting!"); //(haven't implemented restart yet - hit refresh)");
		canvas.clear();

    	startWholeGame();
    }
}

//if there are any items in inventory draw them on blue background
function initInventory(){

	invBackground = new fabric.Rect({
	  left: 0,
	  top: 0,
	  fill: 'blue',
	  width: clientWidth,
	  height: gridHeight * 2,
	  opacity: 0.3
	});	
	canvas.add(invBackground);
	
	
	
	if(player != undefined && player.inventoryText != undefined){
		for(var i = 0; i < player.inventoryText.length; i+= 1){
			canvas.add(player.inventoryImages[i]);
			canvas.add(player.inventoryText[i]);
			
			player.inventoryImages[i].bringToFront();
			player.inventoryText[i].bringToFront();


		};
	};
	
	canvas.add(message);
}

window.onkeyup = function(e) {
		if(e.keyCode >= 49 && e.keyCode <= 58) //motors
			stoppedPressingMotor = true;
	
		if(e.keyCode == 13 || e.keyCode == 16)//finish rotation
			player.finishRotating();
	};


function keyListener(e){
	if(!willRestart){
		
	    if(!e){
	        //for IE
	        e = window.event;
	    }
		
	    if((e.keyCode >= 37 && e.keyCode <= 40) || (e.keyCode >= 32 && e.keyCode <= 34))
	    		e.preventDefault();
	    code = e.keyCode;
		changeState(e.keyCode,new Date - lastTime < 500 && lastKey == e.keyCode);
		lastTime = new Date;
		lastKey = e.keyCode;
	}
}

canvas.on('object:selected', function(e) {
	if(e.target == curRival){
		if(ev.isMetaDown()){ //right mouse buttom - iterate onto next rival
			var keys = rivalGrids.keys();
			var num = keys.indexOf('' + selectedRival)
			num += 1;
			if(num == keys.length)
				num = 0;
			selectedRival = rivalGrids[keys[num]];
		}
		else{
			alert("ENTERING PVP");
			jumpToRival();
		}
	}
	else{
		handleBlockSelection(e.target);
	}
}); 

canvas.on('selection:cleared', function(e) {
	player.deselected();
});

//for adding and removing blocks when editing player shape
function handleBlockSelection(block){
	if(block == delImg){
		deleting = true;
	}
	else if(block.isDamagedBlock){
		message.setText("Can't modify broken block!");
		message.setColor('red');
	}
	else if(block.isAddPlace){
		if(!deleting)
			player.convertAddPlace(block); //TODO only player can add/remove blocks for now. 
		else{								//when I give that functionality to enemies will need to redo and use "block.owner"
			message.setText("Can't delete, No block selected!");
			message.setColor('red');
		}
		canvas.setActiveObject(player.tryToSelectWhatIHadSelectedBefore(lastSelectedBlock));
	}
	else if(block.isDeletePlace){
		if(deleting){
			player.deleteBlock(block,true);
			canvas.setActiveObject(delImg);
		}
		else{
			//delete the block
			player.deleteBlock(block,false);
			//replace it with new
			block = gameGrid[block.myX][block.myY];
			if(block.isAddPlace)
				player.convertAddPlace(block);
			canvas.setActiveObject(player.tryToSelectWhatIHadSelectedBefore(lastSelectedBlock));
		}
	}
	else if(block.inventory != undefined){
		player.selectFromInventory(block.inventory);
		lastSelectedBlock = block.inventory;
		deleting = false;
	}
}

canvas.on('mouse:up', function(options) {
		player.finishEditBlockRotation();
})

function callScrollLoop(){
	setTimeout('scrollLoop()',scrollDelay);
}

function waitForTimeout(intv){
	setTimeout('updateGame()',intv);
};

//function errorLoop(){
//	if(oldUpdateIndex == updateIndex && !willGoDownStairs){ //hasn't been any updates in 5 * interval = CRASHED
//		alert("CRASHED!");
//		updateGame();
//	}
//	oldUpdateIndex = updateIndex;
//	setTimeout('errorLoop()',interval * 5);
//}
