let blockColors;
let blocks = [];
let people = [];
let maxPeople = 4;

let camFeed;
let video;
let bodies = [];

let smoothingFactor = 0.05;
let smoothedKeypoints = {};
let blockSize = 12;
let maxHP = 5;  // Blocks start at full HP (3) and fade out

let lastMouse = true;

let usedColors = [];
let colorIndex = 0;

function preload() {
  /*let savedBlocks = getItem("savedBlocks");
  if (savedBlocks != null) {
    loadBlocks(savedBlocks);
  }*/
  camFeed = ml5.bodyPose("BlazePose", { flipped: true });
}

function loadBlocks(savedBlocks) {
  for (let blks of savedBlocks) {
    let x = blks.x;
    let y = blks.y;
    let clr = color(red(blks.color), green(blks.color), blue(blks.color), alpha(blks.color));
    blocks.push(new Block(x, y, clr));
   
   let l = blocks.length - 1;
   blocks[l].hp = blks.hp;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);

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
}

function draw() {
  background(0);

  // Draw stored blocks
  for (let b of blocks) {
    b.display();
    b.tempInvul = min(0, b.tempInvul - 1);
  }

  if (bodies.length > 0) {
    drawBodies();
  }
  //for testing
  //drawHandStickFigure(mouseX, mouseY, lastMouse, blockColors[2]);
}

function drawBodies() {
  for (let body of bodies) {
    let person = findPersonById(body.id);
    if (!person) {
      person = new Person(body.id);
      people.push(person);
    }

    person.toggleCooldown = max(0, person.toggleCooldown - 1);

    let col = person.color;
    stroke(col);
    strokeWeight(5);

    smoothBodyPoints(body);

    let head = smoothedKeypoints[body.id][0];  // Head position
    let leftWrist = smoothedKeypoints[body.id][15];
    let rightWrist = smoothedKeypoints[body.id][16];
    let leftThumb = smoothedKeypoints[body.id][17];
    let rightThumb = smoothedKeypoints[body.id][18];
    let leftPinkie = smoothedKeypoints[body.id][19];
    let rightPinkie = smoothedKeypoints[body.id][20];
    let leftIndex = smoothedKeypoints[body.id][21];
    let rightIndex = smoothedKeypoints[body.id][22];

    fill(col);

    // Determine main hand based on initial movement
    if (!person.mainHand) {
      let leftSpeed = dist(leftWrist.x, leftWrist.y, person.prevLeftX, person.prevLeftY);
      let rightSpeed = dist(rightWrist.x, rightWrist.y, person.prevRightX, person.prevRightY);
      person.mainHand = leftSpeed > rightSpeed ? 'left' : 'right';
    }

    let hand = person.mainHand === 'left' ? leftWrist : rightWrist;
    let thumb = person.mainHand === 'left' ? leftThumb : rightThumb;
    let pinkie = person.mainHand === 'left' ? leftPinkie : rightPinkie;
    let index = person.mainHand === 'left' ? leftIndex : rightIndex;

    console.log("Hand: " + hand.x + " , " + hand.y);
    console.log("Thumb: " + thumb.x + " , " + thumb.y);
    console.log("Pinkie: " + pinkie.x + " , " + pinkie.y);
    console.log("Index: " + index.x + " , " + index.y);

    // Detect hand state (fist or open) to toggle draw/erase mode
    if (isHandInFist(hand, thumb, pinkie, index) && person.toggleCooldown <= 0) {
      person.drawMode = true;
      person.toggleCooldown = 30;
    } else if (!isHandInFist(hand, thumb, pinkie, index) && person.toggleCooldown <= 0) {
      person.drawMode = false;
      person.toggleCooldown = 30;
    }

    // Draw stick figure at hand position
    drawHandStickFigure(hand.x, hand.y, person.drawMode, col);

    let handSpeed = dist(hand.x, hand.y, person.prevX, person.prevY);
    let steadyThreshold = 1.0; // Lowered threshold for more responsive painting

    if (handSpeed > steadyThreshold) {
      if (person.drawMode) {
        sprayBlocks(hand.x, hand.y, col);  // Create spray effect at hand position
      } else {
        eraseInsideHead(hand.x, hand.y, 40);  // Gradually erase blocks at hand position
      }
    }

    person.prevX = hand.x;
    person.prevY = hand.y;
    person.prevLeftX = leftWrist.x;
    person.prevLeftY = leftWrist.y;
    person.prevRightX = rightWrist.x;
    person.prevRightY = rightWrist.y;
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
function eraseInsideHead(x, y, radius) {
  for (let i = blocks.length - 1; i >= 0; i--) {
    let b = blocks[i];
    let d = dist(b.x, b.y, x, y);
    
    if (d < radius) {
      b.hp--;  // Reduce HP
      let alphaVal = map(b.hp, 0, maxHP, 0, 255); // Fade effect
      b.color = color(red(b.color), green(b.color), blue(b.color), alphaVal);

      if (b.hp <= 0) {
        blocks.splice(i, 1);  // Remove when fully faded
      }
    }
  }
}

/*
//For Testing Only
function mouseDragged() {
  //console.log("Clicky At " + mouseX + " , " + mouseY);
  if (mouseButton === LEFT) {
    sprayBlocks(mouseX, mouseY, blockColors[2]);
    lastMouse = true;
  } else if (mouseButton === CENTER) {
    eraseInsideHead(mouseX, mouseY, 40);
    lastMouse = false;
  }
}
  */

function drawHandStickFigure(x, y, isDrawMode, baseColor) {
  push();
  strokeWeight(4);
  stroke(baseColor);
  fill(isDrawMode ? baseColor : color(255, 255, 255, 125));  // Transparent in erase mode

  // Head
  ellipse(x, y, 60, 60);

  // Body
  line(x, y + 30, x, y + 80);



  // Arms and Legs (change Position between modes)
  if (isDrawMode) {

      // Arms
    line(x - 38, y + 60, x, y + 40); //left arm
    line(x, y + 40, x + 38, y + 60); //right arm
    line(x, y + 80, x - 14, y + 120); //left leg
    line(x, y + 80, x + 14, y + 120); //right leg
  } else {
      // Arms
    line(x - 38, y + 60, x, y + 40); //left
    line(x, y + 40, x + 38, y + 10); //right (raised arm)
    line(x, y + 80, x, y + 120); //both legs (both legs together)
  }

  pop();
}

function bodyCheck(results) {
  bodies = results;
  let trackedIds = bodies.map(body => body.id);

  // Update last seen time for tracked people
  for (let person of people) {
    if (trackedIds.includes(person.id)) {
      person.lastSeen = millis();
    }
  }

  // Remove people who haven't been seen for a longer duration
  people = people.filter(person => millis() - person.lastSeen < 8000); // Increased timeout to 8 seconds

  // Add new people
  for (let body of bodies) {
    if (!findPersonById(body.id)) {
      people.push(new Person(body.id));
    }
  }
}

class Block {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.hp = maxHP;  // Blocks start at full HP (3)
    this.tempInvul = 0;
  }

  display() {
    fill(this.color);
    noStroke();
    rect(this.x, this.y, blockSize, blockSize);
  }
}

class Person {
  constructor(bodyID) {
    this.id = bodyID;
    this.color = this.assignUniqueColor();
    this.drawMode = true;
    this.lastSeen = millis();
    this.prevX = 0;
    this.prevY = 0;
    this.prevLeftX = 0;
    this.prevLeftY = 0;
    this.prevRightX = 0;
    this.prevRightY = 0;
    this.toggleCooldown = 60;
    this.mainHand = null;
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

// Smooth keypoints using EMA (low-pass filter)
function smoothBodyPoints(body) {
  if (!smoothedKeypoints[body.id]) {
    smoothedKeypoints[body.id] = body.keypoints.map(kp => ({ x: kp.x, y: kp.y }));
  } else {
    for (let i = 0; i < body.keypoints.length; i++) {
      smoothedKeypoints[body.id][i].x = lerp(smoothedKeypoints[body.id][i].x, body.keypoints[i].x, smoothingFactor);
      smoothedKeypoints[body.id][i].y = lerp(smoothedKeypoints[body.id][i].y, body.keypoints[i].y, smoothingFactor);
    }
  }
}

function isHandInFist(wrist, thumb, pinkie, index) {
  let threshold = 90; // Distance threshold to consider the hand as a fist

  let thumbDist = dist(wrist.x, wrist.y, thumb.x, thumb.y);
  let pinkieDist = dist(wrist.x, wrist.y, pinkie.x, pinkie.y);
  let indexDist = dist(wrist.x, wrist.y, index.x, index.y);

  return thumbDist < threshold && pinkieDist < threshold && indexDist < threshold;
}

function findPersonById(id) {
  return people.find(person => person.id === id);
}