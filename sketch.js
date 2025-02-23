// FIX SAVE/LOAD Comment it out for testing of other features.

let blockColors;
let blocks = [];
let people = [];
let maxPeople = 15;

let camFeed;
let video;
let bodies = [];

let hands = [];

let smoothingFactor = 0.15;

let blockSize = 12;
let maxHP = 10;  // Blocks start at full HP (3) and fade out

let lastMouse = true;

function preload() {
  let savedBlocks = getItem("savedBlocks");
  if (savedBlocks != null) {
    loadBlocks(savedBlocks);
  }
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

  //frameRate(60);
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
  drawHandStickFigure(mouseX, mouseY, lastMouse, blockColors[2]);
}

function drawBodies() {
  for (let body of bodies) {
    let person = findPersonById(body.id);
    if (!person) {
      person = new Person(body);
      people.push(person);
    }

    person.toggleCooldown = max(0, person.toggleCooldown - 1);

    let col = person.color;
    stroke(col);
    strokeWeight(5);

    smoothBodyPoints(body);

    person.head = body[0];  // Head position
    
    //left hand and finger positions
    person.leftThumb = body[21]; 
    person.leftIndex = body[19];
    person.leftPinkie = body[17];
    person.leftWrist = body[15];
    
    //right hand and finger positions
    person.rightThumb = body[22];
    person.rightIndex =  body[20];
    person.rightPinkie =  body[18];
    person.rightWrist = body[16];

    fill(col);

    // Toggle draw/erase mode when raising right hand above head
    if (person.rightWrist.y <= person.head.y - 15 && person.toggleCooldown <= 0) {
      person.drawMode = !person.drawMode;
      person.toggleCooldown = 60;
    }

    let cursor = person.head;  // Use left hand for drawing

    // Draw stick figure at hand position
    drawHandStickFigure(cursor.x, cursor.y, person.drawMode, col);

    let handSpeed = dist(cursor.x, cursor.y, person.prevX, person.prevY);
    let steadyThreshold = 2.5;

    if (handSpeed > steadyThreshold) {
      if (person.drawMode) {
        sprayBlocks(person.head.x, person.head.y, col);  // Create spray effect in head area
      } else {
        eraseInsideHead(person.head.x, person.head.y, 40);  // Gradually erase blocks inside head
      }
    }

    person.prevX = cursor.x;
    person.prevY = cursor.y;
  }
}

// **Spray random blocks inside the head area**
function sprayBlocks(x, y, baseColor) {
  let numBlocks = random(2, 15); // Number of blocks per spray
  let sprayRadius = 35; // Spray area size

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
      storeItem("savedBlocks", blocks);
    }
  }
}

// **Gradually erase blocks inside the head area**
function eraseInsideHead(x, y, radius) {
  for (let i = blocks.length - 1; i >= 0; i--) {
    let b = blocks[i];
    let d = dist(b.x, b.y, x, y);
    
    if (d < radius&& b.tempInvul <= 0) {
      b.hp--;  // Reduce HP
      let alphaVal = map(b.hp, 0, maxHP, 0, 255); // Fade effect
      b.color = color(red(b.color), green(b.color), blue(b.color), alphaVal);
      b.tempInvul = 60;
      if (b.hp <= 0) {
        blocks.splice(i, 1);  // Remove when fully faded
        storeItem("savedBlocks", blocks);
      }
    }
  }
}

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

  for (let person of people) {
    if (trackedIds.includes(person.id)) {
      person.lastSeen = millis();
    }
  }

  for (p = 0; p < people.length; p++) {
    if (millis() - people[p].lastSeen > 3000) {
      blockColors.push(people[p].color);
      people.splice(p, 1);
    }
  }
}

function drawBlock(x, y, baseColor) {
  let gridX;
  let gridY;
  let randomPaint = [int(random(30)), int(random(30)), int(random(30)), int(random(30)), int(random(30)), int(random(30))];

  for (i = 0; i < 30; i++) {
    gridX = floor((x - 15 + i) / blockSize) * blockSize;
    gridY = floor((y - 15 + i)/ blockSize) * blockSize;

    // Check if a block of the SAME color exists at this position
    let existingBlock = blocks.find(b => 
      b.x === gridX && b.y === gridY && 
      red(b.color) === red(baseColor) &&
      green(b.color) === green(baseColor) &&
      blue(b.color) === blue(baseColor)
    );
    // Only place block if there is NO existing block of the same color
    if (!existingBlock && randomPaint.includes(i)) {
      //console.log("Block should be here. Block #" + i);
      let newColor = color(red(baseColor), green(baseColor), blue(baseColor), 255); // Full opacity
      blocks.push(new Block(gridX, gridY, newColor));
    }
  }
}

// **Smooth block fading when erasing**
function eraseBlock(x, y) {
  let gridXmax = floor((x + 15)/ blockSize) * blockSize;
  let gridYmin = floor((y - 15)/ blockSize) * blockSize;
  let gridXmin = floor((x - 15) / blockSize) * blockSize;
  let gridYmax = floor((y + 15) / blockSize) * blockSize;

  for (let i = blocks.length - 1; i >= 0; i--) {
    let b = blocks[i];

    //Make it so it deletes all blocks within 30 of the circle.
    if (b.x <  gridXmax && b.x > gridXmin && b.y < gridYmax && b.x > gridYmin) {
      b.hp--;  // Reduce HP instead of instantly deleting
      let alphaVal = map(b.hp, 0, maxHP, 0, 255); // Fade effect
      b.color = color(red(b.color), green(b.color), blue(b.color), alphaVal); 

      if (b.hp <= 0) {
        blocks.splice(i, 1);  // Remove only when HP runs out
      }
      //break; // Stop checking after finding one
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
  constructor(body) {
    this.id = body.id;
    selCol = random(blockColors);
    for (let i = 0; i < blockColors.length; i++) {
      if (selCol == blockColors[i]) {
        blockColors.splice(i, 1);
        break;
      }
    }
    this.color = random(blockColors);
    this.drawMode = true;
    this.lastSeen = millis();
    this.prevX = 0;
    this.prevY = 0;
    this.toggleCooldown = 60;

    this.head = body[0];  // Head position
    
    //left hand and finger positions
    this.leftThumb = body[21]; 
    this.leftIndex = body[19];
    this.leftPinkie = body[17];
    this.leftWrist = body[15];
    
    //right hand and finger positions
    this.rightThumb = body[22];
    this.rightIndex = body[20];
    this.rightPinkie = body[18];
    this.rightWrist = body[16];
  }
}

function findPersonById(id) {
  return people.find(person => person.id === id);
}
