let blockColors;
let blocks = [];
let people = [];
let maxPeople = 4;

let camFeed;
let video;
let bodies = [];

let smoothingFactor = 0.15;
let smoothedKeypoints = {};
let blockSize = 12;
let maxHP = 3;  // Blocks start at full HP (3) and fade out

function preload() {
  camFeed = ml5.bodyPose("MoveNet", { flipped: true });
}

function setup() {
  createCanvas(800, 600);
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

  frameRate(60);
}

function draw() {
  background(0);

  // Draw stored blocks
  for (let b of blocks) {
    b.display();
  }

  if (bodies.length > 0) {
    drawBodies();
  }
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

    let head = smoothedKeypoints[body.id][0];
    let leftWrist = smoothedKeypoints[body.id][9];
    let rightWrist = smoothedKeypoints[body.id][10];

    fill(col);

    // Toggle draw/erase mode when raising right hand above head
    if (rightWrist.y < head.y && person.toggleCooldown <= 0) {
      person.drawMode = !person.drawMode;
      console.log(person.drawMode ? "Draw Mode ON" : "Erase Mode ON");
      person.toggleCooldown = 60;
    }

    let hand = leftWrist;  // Use left hand for drawing

    // Draw stick figure at hand position
    drawHandStickFigure(hand.x, hand.y, person.drawMode, col);

    // Only paint/erase if hand is moving smoothly
    let handSpeed = dist(hand.x, hand.y, person.prevX, person.prevY);
    let steadyThreshold = 2;

    if (handSpeed > steadyThreshold) {
      if (person.drawMode) {
        drawBlock(hand.x, hand.y, col);
      } else {
        eraseBlock(hand.x, hand.y);
      }
    }

    person.prevX = hand.x;
    person.prevY = hand.y;
  }
}

function drawHandStickFigure(x, y, isDrawMode, baseColor) {
  push();
  strokeWeight(4);
  stroke(baseColor);
  fill(isDrawMode ? baseColor : color(255, 255, 255, 125));  // Transparent in erase mode

  // Head
  ellipse(x, y - 30, 30, 30);

  // Body
  line(x, y - 20, x, y + 20);

  // Arms
  line(x - 14, y, x + 14, y);

  // Legs (different style for draw/erase mode)
  if (isDrawMode) {
    line(x, y + 20, x - 7, y + 40);
    line(x, y + 20, x + 7, y + 40);
  } else {
    line(x, y + 20, x, y + 40);
  }

  pop();
}

function bodyCheck(results) {
  bodies = results;
  let trackedIds = bodies.map(body => body.id);

  for (let person of people) {
    if (trackedIds.includes(person.id)) {
      person.lastSeen = millis();
    }
  }

  people = people.filter(person => millis() - person.lastSeen < 4000);
}

function drawBlock(x, y, baseColor) {
  let gridX = floor(x / blockSize) * blockSize;
  let gridY = floor(y / blockSize) * blockSize;

  // Check if a block of the SAME color exists at this position
  let existingBlock = blocks.find(b => 
    b.x === gridX && b.y === gridY && 
    red(b.color) === red(baseColor) &&
    green(b.color) === green(baseColor) &&
    blue(b.color) === blue(baseColor)
  );

  // Only place block if there is NO existing block of the same color
  if (!existingBlock) {
    let newColor = color(red(baseColor), green(baseColor), blue(baseColor), 255); // Full opacity
    blocks.push(new Block(gridX, gridY, newColor));
  }
}

// **Smooth block fading when erasing**
function eraseBlock(x, y) {
  let gridX = floor(x / blockSize) * blockSize;
  let gridY = floor(y / blockSize) * blockSize;

  for (let i = blocks.length - 1; i >= 0; i--) {
    let b = blocks[i];
    if (b.x === gridX && b.y === gridY) {
      b.hp--;  // Reduce HP instead of instantly deleting
      let alphaVal = map(b.hp, 0, maxHP, 0, 255); // Fade effect
      b.color = color(red(b.color), green(b.color), blue(b.color), alphaVal); 

      if (b.hp <= 0) {
        blocks.splice(i, 1);  // Remove only when HP runs out
      }
      break; // Stop checking after finding one
    }
  }
}

class Block {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.hp = maxHP;  // Blocks start at full HP (3)
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
    this.color = random(blockColors);
    this.drawMode = true;
    this.lastSeen = millis();
    this.prevX = 0;
    this.prevY = 0;
    this.toggleCooldown = 60;
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

function findPersonById(id) {
  return people.find(person => person.id === id);
}
