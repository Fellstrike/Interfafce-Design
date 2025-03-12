let blockColors;
let blocks = [];
let people = [];
let maxPeople = 4;  // Maximum number of people to track

let camFeed;
let video;
let bodies = [];

let smoothingFactor = 0.15;
let pCooldownMax = 180;
let wristDistance = 260;

let screenOffset = 50;

let blockSize = 8;
let maxHP = 6;  // Blocks start at full HP and fade out
let blockInvulTime = 10;  // Invulnerability time after being hit (frames)

let mouseDrawMode = true;

let usedColors = [];
let colorIndex = 0;

let scrollText = "If you want to draw with your other hand raise it above your head.";
let altText = ["I wonder what happens when you raise both hands at the same time?",
              "I bet you could paint the whole world.", 
              "Double what you just did to discover more.", 
              "Removing color would be kind of neat, eh?"];
let displayText;
let showAlt = false;
let altTimer = 0;

let textColor;

function preload() {
  camFeed = ml5.bodyPose("MoveNet", { flipped: true });
}

function setup() {

  //map canvas to video resolution.
  video = createCapture(VIDEO);
  video.size(windowWidth, windowHeight);
  video.hide();

  let canvasWidth = video.width * 0.975;
  let canvasHeight = video.height * 0.975;

  createCanvas(canvasWidth, canvasHeight);
  background(0);

  camFeed.detectStart(video, bodyCheck);

  textColor = color(255, 255, 255, 200);

  blockColors = [
    color(255, 0, 0), color(252, 149, 129), color(255, 106, 0),
    color(232 , 143, 0), color(255, 255, 0), color(195, 255, 0),
    color(0, 200, 0), color(0,  255, 174), color(0, 204, 255),
    color(0, 0, 255), color(174, 0, 255), color(255, 0, 255),
    color(255, 0, 162), color(147, 120, 255), color(0, 90, 138), color(255, 191, 248)
  ];

  shuffle(blockColors, true);

  frameRate(60);

  noCursor();
}

/*function loadBlocks() {
  let savedData = localStorage.getItem("savedBlocks");
  if (savedData != null) {
    let blockData = JSON.parse(savedData);
    blocks = blockData.map(b => new Block(b.x, b.y, color(b.color), b.hp));
  }
}*/

function draw() {
  background(0);

  // Draw stored blocks
  for (let b of blocks) {
    b.display();
    b.tempInvul = max(0, b.tempInvul - 1);
  }

  //draws artists
  if (people.length > 0) {
    drawBodies();
    /*if(people[0].head.y >= height - (screenOffset)) {
      noLoop();
     }
     else {
      console.log("Head Y value: " + people[0].head.y);
     }*/
  }

  push();
  fill(textColor);
  textSize(38);
  textAlign(CENTER);
  if (!showAlt) { text(scrollText, 0, 30, width, 50);}
  else {text(displayText, 0, 30, width, 50);}
  pop();

  altTimer = max(0, altTimer - 1);
  if (altTimer === 0) {
    showAlt = false;
    textColor = color(255, 255, 255, 200);
  }
  //
  //SAVE PERODIACLLY
 /* if (frameCount % 300 === 0) { // Save every 5 seconds (assuming 60 FPS)
    saveBlocks();
  } */

}

function drawBodies() {
  for (let person of people) {

    person.toggleCooldown = max(0, person.toggleCooldown - 1);

    if (person.leftWrist.y < person.head.y - person.headOffset && person.rightWrist.y < person.head.y - person.headOffset 
      && person.toggleCooldown == 0) {
      // Check if both hands are raised
        person.drawMode = !person.drawMode;
        person.toggleCooldown = pCooldownMax;
        console.log("Artist #" + person.id + " has changed modes.");
        altTimer = 40;
        showAlt = true;
        textColor = person.color;
        displayText = altText[3];
    }
    else if (person.leftWrist.y < person.head.y - person.headOffset && person.mainHand === 'right' && person.toggleCooldown == 0) {
      //check if left hand is raised.
      person.mainHand = 'left';
      textColor = person.color;
      person.color = person.assignUniqueColor();
      console.log("Artist #" + person.id + " has changed colors.");
      person.toggleCooldown = pCooldownMax;
      altTimer = 20;
      showAlt = true;
      displayText = random(altText);
    } else if (person.rightWrist.y < person.head.y - person.headOffset && person.mainHand === 'left' && person.toggleCooldown == 0) {
      //check if right hand is raised
      person.mainHand = 'right';
      textColor = person.color;
      person.color = person.assignUniqueColor();
      console.log("Artist #" + person.id + " has changed colors.");
      person.toggleCooldown = pCooldownMax;
      altTimer = 20;
      showAlt = true;
      displayText = random(altText);
    }

    let hand = person.mainHand === 'left' ? person.leftWrist : person.rightWrist;

    let handSpeed = dist(hand.x, hand.y, person.prevX, person.prevY);
    let steadyThreshold = 2.0; // Lowered threshold for more responsive painting

    if (handSpeed > steadyThreshold) {
      if (person.drawMode) {
        sprayBlocks(hand.x, hand.y, person.color);  // Create spray effect at hand position
      } else {
        gradualErase(hand.x, hand.y, 40);  // Gradually erase blocks at hand position
      }
    }

    person.prevX = hand.x;
    person.prevY = hand.y;

    drawCursor(person);
  }
}

// **Spray random blocks inside the head area**
function sprayBlocks(x, y, baseColor) {
  let numBlocks = 10; // Number of blocks per spray
  let sprayRadius = 30; // Spray area size

  for (let i = 0; i < numBlocks; i++) {
    let angle = random(TWO_PI);
    let radius = random(sprayRadius);
    let blockX = x + cos(angle) * radius;
    let blockY = y + sin(angle) * radius;

    let gridX = floor(blockX / blockSize) * blockSize;
    let gridY = floor(blockY / blockSize) * blockSize;

    let existingBlock = blocks.find(b => 
      b.x === gridX && b.y === gridY && 
      red(b.color) === red(baseColor) &&
      green(b.color) === green(baseColor) &&
      blue(b.color) === blue(baseColor)
    );

    if (!existingBlock) {
      let newColor = color(red(baseColor), green(baseColor), blue(baseColor), 255);
      blocks.push(new Block(gridX, gridY, newColor));
    }
  }
}

// **Gradually erase blocks inside the eraser area**
function gradualErase(x, y, radius) {
  for (let i = blocks.length - 1; i >= 0; i--) {
    let b = blocks[i];
    let d = dist(b.x, b.y, x, y);
    
    if (d < radius && b.tempInvul <= 0) {
      b.tempInvul = blockInvulTime;  // Temporary invulnerability to prevent rapid erasing
      b.hp--;  // Reduce HP
      let alphaVal = map(b.hp, 0, maxHP, 0, 255); // Fade effect
      b.color = color(red(b.color), green(b.color), blue(b.color), alphaVal);

      if (b.hp <= 0) {
        blocks.splice(i, 1);  // Remove when fully faded
      }
    }
  }
}

function drawCursor(person) {
  push();
  strokeWeight(6);
  stroke(200);
  let baseColor = person.color;
  fill(person.drawMode ? baseColor : color(red(baseColor), green(baseColor), blue(baseColor), 85));  // Transparent in erase mode
  let offset = -76;
  let x = person.rightWrist.x;
  let y = person.rightWrist.y;

  if (person.mainHand === 'left') {
    offset = 0;
    x = person.leftWrist.x;
    y = person.leftWrist.y;
  }

  y -= screenOffset;

  //Label
  textAlign(CENTER);
  textSize(min(width, height) * 0.03);
  text("Artist " + person.id, x + 38 + offset, y + 85);

  // Head
  ellipse(x + 38 + offset, y - 50, 60, 60);

  // Body
  line(x + 38 + offset, y - 20, x + 38 + offset, y + 30);

  line(x + 38 + offset, y - 10, x + offset, y + 10); //right arm
  line(x + 38 + offset, y - 10, x + 76 + offset, y + 10); //left arm

  line(x + 38 + offset, y + 30, x + 24 + offset, y + 70); //left leg
  line(x + 38 + offset, y + 30, x + 52 + offset, y + 70); //right leg

  // Change Between an Eraser and Spray Paint
  if (person.drawMode) {
    fill(red(baseColor), green(baseColor), blue(baseColor), 85);
    ellipse(x, y, 40);
    fill(baseColor);
    ellipse(x, y + 35, 15);
    beginShape();
    vertex(x - 7.5, y + 35);
    vertex(x - 7.5, y + 10);
    vertex(x + 7.5, y + 10);
    vertex(x + 7.5, y + 35);
    endShape();
    ellipse(x, y + 10, 15);
    fill(0);
    rect(x - 2.5, y + 7, 5, 5);
    fill(baseColor);
  } 
    
  else {
    fill(red(baseColor), green(baseColor), blue(baseColor), 85);
    rect(x - 12.5, y - 20, 25, 50); // Representing a giant eraser
    beginShape();
    vertex(x - 12.5, y - 20);
    vertex(x - 14, y - 15);
    vertex(x - 14, y + 25);
    vertex(x - 12.5, y + 25);
    vertex(x + 12.5, y + 25);
    vertex(x + 11, y + 25);
    vertex(x - 14, y + 25);
    vertex(x- 14, y - 20);
    endShape();
  }

  pop();

  push();
  strokeWeight(2);
  stroke(baseColor);
  fill(baseColor);  // Transparent in erase mode

  // Head
  ellipse(x + 38 + offset, y - 50, 60, 60);

  // Body
  line(x + 38 + offset, y - 20, x + 38 + offset, y + 30);

  line(x + 38 + offset, y - 10, x + offset, y + 10); //right arm
  line(x + 38 + offset, y - 10, x + 76 + offset, y + 10); //left arm

  line(x + 38 + offset, y + 30, x + 24 + offset, y + 70); //left leg
  line(x + 38 + offset, y + 30, x + 52 + offset, y + 70); //right leg

  if (person.drawMode) {
    fill(red(baseColor), green(baseColor), blue(baseColor), 85);
    ellipse(x, y, 40);
    fill(baseColor);
    ellipse(x, y + 35, 15);
    beginShape();
    vertex(x - 7.5, y + 35);
    vertex(x - 7.5, y + 10);
    vertex(x + 7.5, y + 10);
    vertex(x + 7.5, y + 35);
    endShape();
    ellipse(x, y + 10, 15);
    fill(0);
    rect(x - 2.5, y + 7, 5, 5);
    fill(baseColor);
  } 
  
  else {
    fill(red(baseColor), green(baseColor), blue(baseColor), 85);
    rect(x - 12.5, y - 20, 25, 50); // Representing a giant eraser
    beginShape();
    vertex(x - 12.5, y - 20);
    vertex(x - 14, y - 15);
    vertex(x - 14, y + 25);
    vertex(x - 12.5, y + 25);
    vertex(x + 12.5, y + 25);
    vertex(x + 11, y + 25);
    vertex(x - 14, y + 25);
    vertex(x- 14, y - 20);
    //vertex(x - 20, y - 10);
    endShape();
  }

  pop();
}

function saveBlocks() {
  let blockData = blocks.map(b => ({ x: b.x, y: b.y, color: [red(b.color), green(b.color), blue(b.color), alpha(b.color)], hp: b.hp }));
  localStorage.setItem("savedBlocks", JSON.stringify(blockData));
}

function bodyCheck(results) {
  bodies = results;
  
  for(let i = people.length; people.length < bodies.length && i < maxPeople; i = people.length) {
    people.push(new Person(bodies[i]));
    console.log("New Artist Detected. Artist #" + bodies[i].id);
  }

  for (let c = 0; c < people.length; c++) {
    for (let body of bodies) {
      if (people[c].id === body.id || dist(people[c].head.x, people[c].head.y, body.keypoints[0].x, body.keypoints[0].y) < 10) {
        people[c].updateLoc(body);
        let tempOffset = (height - people[c].head.y) / 10;
        if (tempOffset > screenOffset) {screenOffset = tempOffset;}
      }
    }
  }

  //console.log(people.length);

  // Remove people who haven't been seen for a longer duration
  people = people.filter(person => millis() - person.lastSeen < 8000); // Increased timeout to 8 seconds
}

//Debug purposes only
function mouseClicked() {
  if (mouseButton === LEFT) {
    mouseDrawMode = !mouseDrawMode;
  }
  sprayBlocks(mouseX, mouseY, color(random(blockColors)));

  altTimer = 20;
  showAlt = true;
  displayText = random(altText);
}

class Block {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.hp = maxHP;  // Blocks start at full HPa
    this.tempInvul = 0;
  }

  display() {
    fill(this.color);
    noStroke();
    rect(this.x, this.y, blockSize, blockSize);
  }
}

//Need to put the code to draw the person in here instead of the main code.
class Person {
  constructor(body) {
    this.id = body.id;
    this.color = this.assignUniqueColor();
    this.drawMode = true;
    this.lastSeen = millis();
    this.prevX = 0;
    this.prevY = 0;
    this.toggleCooldown = 120;
    this.mainHand = 'right';
    this.head = body.keypoints[0];
    this.leftWrist = body.keypoints[9];
    this.rightWrist = body.keypoints[10];
    this.headOffset = (height - this.head.y) / 25;
  }

  // Smooth keypoints using EMA (low-pass filter)
  updateLoc(body) {
    this.head.x = lerp(this.head.x, body.keypoints[0].x, smoothingFactor);
    this.head.y = lerp(this.head.y, body.keypoints[0].y, smoothingFactor);
    this.leftWrist.x = lerp(this.leftWrist.x, body.keypoints[9].x, smoothingFactor);
    this.leftWrist.y = lerp(this.leftWrist.y, body.keypoints[9].y, smoothingFactor);
    this.rightWrist.x = lerp(this.rightWrist.x, body.keypoints[10].x, smoothingFactor);
    this.rightWrist.y = lerp(this.rightWrist.y, body.keypoints[10].y, smoothingFactor);
    this.lastSeen = millis();
    this.headOffset = (height - this.head.y) / 25;
  }

  assignUniqueColor() {
    if (usedColors.length >= blockColors.length) {
      usedColors = [];
      colorIndex = 0;
    }

    while (usedColors.includes(blockColors[colorIndex])) {
      colorIndex = (colorIndex + 1) % blockColors.length;
    }

    let assignedColor = blockColors[colorIndex];
    usedColors.push(assignedColor);
    colorIndex = (colorIndex + 1) % blockColors.length;

    return assignedColor;
  }
}