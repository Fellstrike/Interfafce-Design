let blockColors;
let blocks = [];
let people = [];
let maxPeople = 4;  // Maximum number of people to track

let camFeed;
let video;
let bodies = [];

let smoothingFactor = 0.15;
let pCooldownMax = 120;

let blockSize = 8;
let maxHP = 8;  // Blocks start at full HP and fade out
let blockInvulTime = 10;  // Invulnerability time after being hit (frames)

let mouseDrawMode = true;

let usedColors = [];
let colorIndex = 0;

function preload() {
  camFeed = ml5.bodyPose("MoveNet", { flipped: true });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);
  //map canvas to video resolution.
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  camFeed.detectStart(video, bodyCheck);

  blockColors = [
    color(255, 0, 0), color(0, 255, 0), color(0, 0, 255),
    color(255, 255, 0), color(255, 0, 255), color(0, 255, 255),
    color(128, 0, 255), color(0, 128, 255), color(128, 128, 255),
    color(255, 128, 0), color(255, 0, 128), color(255, 128, 128),
    color(0, 255, 128), color(128, 255, 0), color(128, 255, 128)
  ];

  shuffle(blockColors, true);

  //window.addEventListener("beforeunload", saveBlocks);

  //loadBlocks();

  frameRate(60);

  noCursor();
}

function loadBlocks() {
  let savedData = localStorage.getItem("savedBlocks");
  if (savedData != null) {
    let blockData = JSON.parse(savedData);
    blocks = blockData.map(b => new Block(b.x, b.y, color(b.color), b.hp));
  }
}

function draw() {
  background(0);

  // Draw stored blocks
  for (let b of blocks) {
    b.display();
    b.tempInvul = max(0, b.tempInvul - 1);
  }

  if (people.length > 0) {
    drawBodies();
  }

  if (frameCount % 300 === 0) { // Save every 5 seconds (assuming 60 FPS)
    //saveBlocks();
  }

  //drawCursor(mouseX, mouseY, mouseDrawMode, color(255, 0, 0));
}

function drawBodies() {
  for (let person of people) {

    person.toggleCooldown = max(0, person.toggleCooldown - 1);

    let col = person.color;
    stroke(col);
    strokeWeight(5);

    let head = person.keypoints[0];  // Head position
    let leftWrist = person.keypoints[9];
    let rightWrist = person.keypoints[10];

    fill(col);

    // Determine main hand based on hand lifted above head
    // Check which hand is above the head
    if (leftWrist.y < head.y && rightWrist.y < head.y) {
      // If both are above, keep the previous main hand or choose the faster one
      person.mainHand = 'right'; // Default to right hand
    } else if (leftWrist.y < head.y && person.mainHand === 'right') {
      person.mainHand = 'left';
      person.color = person.assignUniqueColor();
      person.toggleCooldown = pCooldownMax;
    } else if (rightWrist.y < head.y && person.mainHand === 'left') {
      person.mainHand = 'right';
      person.color = person.assignUniqueColor();
      person.toggleCooldown = pCooldownMax;
    }
   
    if (person.mainHand === 'right' && person.toggleCooldown <= 0) {
      // Check if the left hand is by the right shoulder
      if (dist(leftWrist.x, leftWrist.y, person.keypoints[6].x, person.keypoints[6].y) < 120) { 
        person.drawMode = !person.drawMode;
        person.toggleCooldown = pCooldownMax;
      }
    }
    else if (person.mainHand === 'left' && person.toggleCooldown <= 0) {
      // Check if the right hand is by the left shoulder
      if (dist(rightWrist.x, rightWrist.y, person.keypoints[5].x, person.keypoints[5].y) < 120) { 
        person.drawMode = !person.drawMode;
        person.toggleCooldown = pCooldownMax;
      }
    }

    let hand = person.mainHand === 'left' ? leftWrist : rightWrist;

    // Draw stick figure at hand position
    drawCursor(hand.x, hand.y, person.drawMode, col, person.mainHand);

    let handSpeed = dist(hand.x, hand.y, person.prevX, person.prevY);
    let steadyThreshold = 2.0; // Lowered threshold for more responsive painting

    if (handSpeed > steadyThreshold) {
      if (person.drawMode) {
        sprayBlocks(hand.x, hand.y, col);  // Create spray effect at hand position
      } else {
        gradualErase(hand.x, hand.y, 40);  // Gradually erase blocks at hand position
      }
    }

    person.prevX = hand.x;
    person.prevY = hand.y;
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

// **Gradually erase blocks inside the head area**
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

function drawCursor(x, y, isDrawMode, baseColor, mainHand) {
  push();
  strokeWeight(5);
  stroke(200);
  fill(isDrawMode ? baseColor : color(red(baseColor), green(baseColor), blue(baseColor), 85));  // Transparent in erase mode
  let offset = -76;

  if (mainHand === 'left') {
    offset = 0;
  }
  // Head
  ellipse(x + 38 + offset, y - 50, 60, 60);

  // Body
  line(x + 38 + offset, y - 20, x + 38 + offset, y + 30);

  line(x + 38 + offset, y - 10, x + offset, y + 10); //right arm
  line(x + 38 + offset, y - 10, x + 76 + offset, y + 10); //left arm

  line(x + 38 + offset, y + 30, x + 24 + offset, y + 70); //left leg
  line(x + 38 + offset, y + 30, x + 52 + offset, y + 70); //right leg

  // Change Between an Eraser and Spray Paint
  if (isDrawMode) {
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

  if (isDrawMode) {
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
  
  for(let i = people.length; people.length < bodies.length; i = people.length) {
    people.push(new Person(bodies[i]));
  }

  for (let person of people) {
    for (let body of bodies) {
      if (person.id === body.id) {
        person.updateLoc(body);
      }
    }
  }

  // Remove people who haven't been seen for a longer duration
  people = people.filter(person => millis() - person.lastSeen < 8000); // Increased timeout to 8 seconds
}

function findPersonById(id) {
  return people.find(person => person.id === id);
}

function mouseClicked() {
  if (mouseButton === LEFT) {
    mouseDrawMode = !mouseDrawMode;
  }
  for (let person of people) {
    person.drawMode = !person.drawMode;
  }
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

//follow smoothedBody function to transfer bodyKeypoint coordinates to the person object/people array.
class Person {
  constructor(body) {
    this.id = body.id;
    this.color = this.assignUniqueColor();
    this.drawMode = true;
    this.lastSeen = millis();
    this.prevX = 0;
    this.prevY = 0;
    this.toggleCooldown = 120;
    this.mainHand = null;
    this.keypoints = body.keypoints.map(kp => ({ x: kp.x, y: kp.y }));
  }

  // Smooth keypoints using EMA (low-pass filter)
  updateLoc(body) {
    for (let i = 0; i < body.keypoints.length; i++) {
      this.keypoints[i].x = lerp(this.keypoints[i].x, body.keypoints[i].x, smoothingFactor);
      this.keypoints[i].y = lerp(this.keypoints[i].y, body.keypoints[i].y, smoothingFactor);
    }
    this.lastSeen = millis();
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