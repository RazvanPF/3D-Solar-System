// Declared Variables - CONSTANTS
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
const updateInterval = 100; // Update every 100 milliseconds
const baseSpeed = 0.01;

// Declared Variables - LETs
let hasArrived = false; // Flag to track if the spaceship has arrived
let isPlaying = true;
let speedMultiplier = 1.0; // initial speed multiplier
let targetPosition = null;
let pickResult = null;
let currentLitPlanet = null;
let planetLight = null;
let intervalId = null;
let celestialBodies = []; // Define celestialBodies array
let moons = [];
let sun; // Declare sun globally
let baseTime = Date.now();
let lastPickedMesh = null;

// Create a function to update the time scale based on the slider value
let simulationSpeed = 1;

function updateSimulationSpeed(speed) {
    // Map the slider value (1 to 100) to a speed factor (0.01x to 1.0x)
    simulationSpeed = (speed / 100) * 0.99 + 0.01; // Maps 1 to 0.01, 100 to 1.0
    updateSliderText(speed);
};

const createScene = function () {
    const scene = new BABYLON.Scene(engine);

    // Enable collision detection
    scene.collisionsEnabled = true;

    // Camera
    const camera = new BABYLON.ArcRotateCamera("camera1", Math.PI / 2, Math.PI / 4, 30, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.upperRadiusLimit = 180;
    camera.lowerRadiusLimit = 5;
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = Math.PI / 2 - 0.1;
    camera.radius = camera.upperRadiusLimit; // Start zoomed out
    camera.attachControl(canvas, true, false, false); // Disable right-click drag behavior
    camera.checkCollisions = true; // Enable collision detection for camera

    // Add a hemispheric light for the asteroids
    const asteroidLight = new BABYLON.HemisphericLight("asteroidLight", new BABYLON.Vector3(0, -1, 0), scene);
    asteroidLight.position = new BABYLON.Vector3(0, 100, 0); // Position the light above the scene
    asteroidLight.intensity = 1.0; // Ensure intensity is adequate

    // Add an event listener to the existing speedSlider to update the simulation speed
    speedSlider.addEventListener("input", (event) => {
        const speed = parseFloat(event.target.value);
        updateSimulationSpeed(speed);
        updateSliderText(speed);
    });
    
    // Call updateSliderText to set the initial value
    updateSliderText(speedSlider.value);
    
    // Set initial simulation speed to 1.0 (normal speed)
    updateSimulationSpeed(100);

    // Create the sun with proper material and texture
    const sunTextureUrl = "https://raw.githubusercontent.com/razvanpf/Images/main/2ksun.jpg";
    sun = BABYLON.MeshBuilder.CreateSphere("sun", { diameter: 20 }, scene);
    const sunMaterial = new BABYLON.StandardMaterial("sunMaterial", scene);
    sun.renderingGroupId = 2; // Ensure the rendering group ID is 0

    // Ensure the texture is loaded and applied
    sunMaterial.diffuseTexture = new BABYLON.Texture(sunTextureUrl, scene, false, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE, () => {
        console.log("Sun texture loaded successfully.");
    }, (message) => {
        console.error("Failed to load sun texture:", message);
    });

    // Disable lighting and apply emissive texture
    sunMaterial.emissiveTexture = new BABYLON.Texture(sunTextureUrl, scene);
    sunMaterial.disableLighting = true;
    sun.material = sunMaterial;
    sunMaterial.backFaceCulling = false; // Ensure that the material is rendered from both sides
    sunMaterial.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE; // Set transparency mode to opaque
    sun.position = new BABYLON.Vector3(0, 0, 0);
    sun.checkCollisions = true; // Enable collision detection for the sun

    console.log("Sun created:", sun);

    // Verify the material properties
    console.log("Sun material properties:", {
        emissiveTexture: sunMaterial.emissiveTexture,
        disableLighting: sunMaterial.disableLighting,
    });

    // Step 3: Create and Configure the Glow Layer
    const glowLayer = new BABYLON.GlowLayer("glow", scene);
    glowLayer.intensity = 1.5; // Adjust intensity as needed
    glowLayer.addIncludedOnlyMesh(sun);

    console.log("Glow layer created and applied to the sun.");

    // Function to create sun rays
    function createSunRays(scene, sun) {
        const sunRays = new BABYLON.VolumetricLightScatteringPostProcess('godrays', 1.0, scene.activeCamera, sun, 100, BABYLON.Texture.BILINEAR_SAMPLINGMODE, engine, false);
        sunRays.exposure = 0.3;
        sunRays.decay = 0.96815;
        sunRays.weight = 0.58767;
        sunRays.density = 0.926;
        sunRays.renderingGroupId = 0; // Ensure the rendering group ID is 0
        console.log("Sun rays created and applied to the sun.");
    }

    createSunRays(scene, sun);

    // ASTEROIDS //

    // Asteroid belts constants
    const startButton = document.getElementById('welcomeBtn');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    let mainAsteroids = [];
    let kuiperAsteroids = [];

    // Function to load a model using the GLB URL
    function loadModel(url, scene, scaling = 1) {
        return new Promise((resolve, reject) => {
            BABYLON.SceneLoader.ImportMesh("", url, "", scene, function (meshes) {
                if (meshes.length > 0) {
                    let model = meshes[0];
                    model.scaling = new BABYLON.Vector3(scaling, scaling, scaling);

                    // Apply a basic material to the asteroid
                    const asteroidMaterial = new BABYLON.StandardMaterial("asteroidMaterial", scene);
                    asteroidMaterial.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/razvanpf/Images/main/2k_mars.jpg", scene); // Example texture
                    asteroidMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2); // Ensure a slight emissive color for visibility
                    asteroidMaterial.specularColor = new BABYLON.Color3(1, 1, 1); // Add specular highlights for light reflection
                    asteroidMaterial.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7); // Ensure diffuse color is set
                    model.material = asteroidMaterial;

                    // Ensure the asteroid is visible
                    model.isVisible = true;

                    resolve(model);
                } else {
                    reject("No meshes found in the model");
                }
            }, null, function (scene, message, exception) {
                console.error("SceneLoader ImportMesh error:", message, exception);
                reject(exception || message);
            });
        });
    }

    // Function to create an asteroid belt
    async function createAsteroidBelt(scene, innerRadius, outerRadius, numAsteroids, yRange, progressCallback) {
        const asteroidPromises = [];
        for (let i = 0; i < numAsteroids; i++) {
            asteroidPromises.push(loadModel(asteroidUrl, scene, 0.08).finally(progressCallback)); // Adjust the scaling as needed
        }

        const asteroidModels = await Promise.all(asteroidPromises);

        const asteroids = [];
        for (let i = 0; i < asteroidModels.length; i++) {
            const asteroid = asteroidModels[i];
            const angle = Math.random() * Math.PI * 2;
            const radius = innerRadius + Math.random() * (outerRadius - innerRadius);

            asteroid.position.x = radius * Math.cos(angle);
            asteroid.position.z = radius * Math.sin(angle);
            asteroid.position.y = (Math.random() - 0.5) * yRange; // Randomize the Y position for a thicker belt

            // Randomize initial rotation
            asteroid.rotationQuaternion = new BABYLON.Quaternion.RotationYawPitchRoll(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            // Apply a random scale
            const randomScale = 0.04 + Math.random() * 0.04; // Scale between 0.04 and 0.08 for better visibility
            asteroid.scaling = new BABYLON.Vector3(randomScale, randomScale, randomScale);

            // Ensure the asteroid does not cast shadows
            asteroid.receiveShadows = false;

            // Ensure the asteroid is pickable
            asteroid.isPickable = true;

            // Add action manager for hover and click actions
            asteroid.actionManager = new BABYLON.ActionManager(scene);
            asteroid.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
                highlightAsteroidBelt(asteroid);
            }));
            asteroid.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
                clearHighlights();
            }));
            asteroid.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                showDetailsPopup(asteroid);
            }));

            // Correctly add asteroids to the light
            const asteroidLight = scene.getLightByName("asteroidLight");
            if (asteroidLight) {
                asteroid.getChildMeshes().forEach(mesh => {
                    console.log(`Adding mesh ${mesh.name} with position`, mesh.position);
                    asteroidLight.includedOnlyMeshes.push(mesh);
                });
            }

            asteroids.push(asteroid);
        }
        return asteroids;
    }

    // Function to create the asteroid belt between Mars and Jupiter
    async function createMainAsteroidBelt(scene, progressCallback) {
        const innerRadius = 55;
        const outerRadius = 65; // Reduced outer radius to keep the belt between Mars and Jupiter
        const numAsteroids = 150; // Increased number of asteroids
        const yRange = 3; // Reduced thickness for a more ring-like shape

        mainAsteroids = await createAsteroidBelt(scene, innerRadius, outerRadius, numAsteroids, yRange, progressCallback);
        animateAsteroids(mainAsteroids, 0.00005); // Adjust speed as necessary
    }

    // Function to create the Kuiper Belt beyond Neptune
    async function createKuiperBelt(scene, progressCallback) {
        const innerRadius = 150;
        const outerRadius = 180; // Slightly reduced outer radius
        const numAsteroids = 260; // Increased number of asteroids
        const yRange = 5; // Adjust as needed for thickness

        kuiperAsteroids = await createAsteroidBelt(scene, innerRadius, outerRadius, numAsteroids, yRange, progressCallback);
        animateAsteroids(kuiperAsteroids, 0.00001); // Adjust speed as necessary
    }


    // Function to animate asteroids orbiting around the sun
    function animateAsteroids(asteroids, speed) {
        scene.registerBeforeRender(() => {
            const deltaTime = engine.getDeltaTime() * speed * simulationSpeed; // Speed adjustment with simulation speed
            asteroids.forEach(asteroid => {
                const radius = Math.sqrt(asteroid.position.x ** 2 + asteroid.position.z ** 2);
                const angle = Math.atan2(asteroid.position.z, asteroid.position.x) + deltaTime; // Change - deltaTime to + deltaTime for counter-clockwise rotation

                asteroid.position.x = radius * Math.cos(angle);
                asteroid.position.z = radius * Math.sin(angle);
            });
        });
    }

    // Function to update the progress bar
    function updateProgressBar(progress) {
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${Math.round(progress)}%`;
        if (progress >= 100) {
            progressText.textContent = "Complete!";
        }
    }

    // Function to create the asteroid belts and update the progress bar
    async function createAsteroidBelts(scene) {
        const totalAsteroids = 410; // Total number of asteroids in both belts
        let loadedAsteroids = 0;

        const progressCallback = () => {
            loadedAsteroids++;
            const progress = (loadedAsteroids / totalAsteroids) * 100;
            updateProgressBar(progress);
        };

        await createMainAsteroidBelt(scene, progressCallback);
        await createKuiperBelt(scene, progressCallback);

        startButton.disabled = false; // Enable the button once loading is complete
        startButton.style.backgroundColor = ''; // Reset the button style
        startButton.style.color = ''; // Reset the text color
        startButton.style.cursor = ''; // Reset the cursor
    }

    // Call the function to create asteroid belts
    createAsteroidBelts(scene).then(() => {
    }).catch((error) => {
        console.error("Failed to create asteroid belts:", error);
    });

    // Event listener for the start button
    startButton.addEventListener('click', () => {
        document.getElementById('welcomePopup').style.display = 'none';
        document.getElementById('renderCanvas').classList.remove('blur');
    });

    // Add an invisible mesh around the Sun to extend the clickable area (smaller size for closer interactions)
    const invisibleSun = BABYLON.MeshBuilder.CreateSphere("invisibleSun", { diameter: 21 }, scene); // Adjust diameter as needed
    invisibleSun.visibility = 0; // Make it invisible
    invisibleSun.position = sun.position; // Ensure it is at the same position as the sun

    // Add action managers to the invisibleSun for interaction
    invisibleSun.actionManager = new BABYLON.ActionManager(scene);
    invisibleSun.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, function () {
        sun.renderOutline = true;
        sun.outlineWidth = 0.1;
        sun.outlineColor = BABYLON.Color3.White();
    }));
    invisibleSun.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, function () {
        sun.renderOutline = false;
    }));
    invisibleSun.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
        moveToTarget(sun.position, () => {
            camera.setTarget(sun.position);
            showPopup(sun);
        });
    }));

    // Function to move the ship to the target position
    function moveToTarget(targetPos, arrivalCallback) {
        targetPosition = targetPos.clone(); // Clone to avoid modifying the original target position
        onArrivalCallback = arrivalCallback;
        scene.registerBeforeRender(moveShip);
    }

    function moveShip() {
        if (targetPosition) {
            const direction = targetPosition.subtract(spaceship.position).normalize();
            const speed = 0.4; // Adjust the speed as needed
            spaceship.position.addInPlace(direction.scale(speed)); // Adjust the speed as needed
    
            if (BABYLON.Vector3.Distance(spaceship.position, targetPosition) < 0.1) {
                scene.unregisterBeforeRender(moveShip); // Stop moving the ship
                targetPosition = null;
                if (onArrivalCallback) {
                    onArrivalCallback(); // Trigger the callback on arrival
                    onArrivalCallback = null; // Clear the callback to avoid repeated calls
                }
            }
        }
    }

    // Sun Rotation
    scene.registerBeforeRender(() => {
        sun.rotation.y -= baseSpeed * simulationSpeed * 0.1;
    });

    // Create and configure celestial bodies, planets, and moons
    const celestialData = [
        {
            name: "Mercury",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_mercury.jpg",
            size: 1,
            distance: 20,
            orbitSpeed: 0.01,
            rotationSpeed: 0.01, // Rotation speed around own axis
            moons: []
        },
        {
            name: "Venus",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_venus_atmosphere.jpg",
            size: 1.2,
            distance: 30,
            orbitSpeed: 0.008,
            rotationSpeed: 0.01, // Rotation speed around own axis
            moons: []
        },
        {
            name: "Earth",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2kearth.jpg",
            size: 1.3,
            distance: 40,
            orbitSpeed: 0.006,
            rotationSpeed: 0.01, // Rotation speed around own axis
            moons: [
                { name: "Moon", size: 0.3, distance: 3, orbitSpeed: 0.02, rotationSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Moon3D.jpg" }
            ]
        },
        {
            name: "Mars",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_mars.jpg",
            size: 1.1,
            distance: 50,
            orbitSpeed: 0.005,
            rotationSpeed: 0.01, // Rotation speed around own axis
            moons: [
                { name: "Phobos", size: 0.1, distance: 2, orbitSpeed: 0.02, rotationSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Phobos3D.jpg" },
                { name: "Deimos", size: 0.1, distance: 3, orbitSpeed: 0.02, rotationSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Deimos3D.jpg" }
            ]
        },
        {
            name: "Jupiter",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_jupiter.jpg",
            size: 2.2,
            distance: 70,
            orbitSpeed: 0.004,
            rotationSpeed: 0.01, // Rotation speed around own axis
            moons: [
                { name: "Io", size: 0.3, distance: 4, orbitSpeed: 0.02, rotationSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/IO3D.jpg" },
                { name: "Europa", size: 0.3, distance: 5, orbitSpeed: 0.02, rotationSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Europa3D.jpg" },
                { name: "Ganymede", size: 0.3, distance: 6, orbitSpeed: 0.02, rotationSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Ganymede.jpg" },
                { name: "Callisto", size: 0.3, distance: 7, orbitSpeed: 0.02, rotationSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Callisto3D.jpg" }
            ]
        },
        {
            name: "Saturn",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_saturn.jpg",
            size: 1.8,
            distance: 90,
            orbitSpeed: 0.003,
            rotationSpeed: 0.01, // Rotation speed around own axis
            moons: [
                { name: "Titan", size: 0.4, distance: 5, orbitSpeed: 0.02, rotationSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Titan3D.jpg" }
            ]
        },
        {
            name: "Uranus",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_uranus.jpg",
            size: 1.5,
            distance: 110,
            orbitSpeed: 0.002,
            rotationSpeed: 0.01, // Rotation speed around own axis
            moons: [
                { name: "Titania", size: 0.4, distance: 5, orbitSpeed: 0.02, rotationSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Titania3D.jpg" },
                { name: "Oberon", size: 0.4, distance: 7, orbitSpeed: 0.02, rotationSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Oberon3Dv2.jpg" },
                { name: "Miranda", size: 0.3, distance: 4, orbitSpeed: 0.02, rotationSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Miranda3D.jpg" }
            ]
        },
        {
            name: "Neptune",
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2kneptune.jpg",
            size: 1.4,
            distance: 130,
            orbitSpeed: 0.001,
            rotationSpeed: 0.01, // Rotation speed around own axis
            moons: [
                { name: "Triton", size: 0.4, distance: 5, orbitSpeed: 0.02, rotationSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/Triton3D.jpg" }
            ]
        }
    ];

    const createRings = (scene) => {
        celestialData.forEach((data, index) => {
            // Create orbit ring with higher tessellation
            const orbit = BABYLON.MeshBuilder.CreateTorus(`orbit${index}`, { diameter: data.distance * 2, thickness: 0.05, tessellation: 128 }, scene);
            const orbitMaterial = new BABYLON.StandardMaterial(`orbitMaterial${index}`, scene);
            orbitMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
            orbitMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
            orbitMaterial.alpha = 0.5; // Set the opacity to 50%
            orbit.material = orbitMaterial;
            orbit.renderingGroupId = 1; // Set the rendering group ID higher than sun rays
        });
    };

    celestialData.forEach((data, index) => {
        // Create planet
        const planet = BABYLON.MeshBuilder.CreateSphere(`planet${index}`, { diameter: data.size * 2 }, scene);
        const planetMaterial = new BABYLON.StandardMaterial(`planetMaterial${index}`, scene);
        planetMaterial.diffuseTexture = new BABYLON.Texture(data.texture, scene);
        planet.material = planetMaterial;
        planetMaterial.specularColor = new BABYLON.Color3(0, 0, 0); // Reduce reflectivity
        planet.position = new BABYLON.Vector3(data.distance, 0, 0);
        planet.renderingGroupId = 1; // Set the rendering group ID higher than sun rays

        // Create rings
        createRings(scene);

        // Set initial position of the planet
        planet.position = new BABYLON.Vector3(data.distance, 0, 0);
        celestialBodies.push({ mesh: planet, data, angle: 0 });

        // Flip the planet upside down
        planet.rotation.x = Math.PI; // Flipping the planet

        // Create rings around Saturn
        const createSaturnRings = (scene, planet) => {
            const ringSettings = [
                { innerDiameter: planet.scaling.x * 5.6, outerDiameter: planet.scaling.x * 6.4, opacity: 0.4, tessellation: 128 },
                { innerDiameter: planet.scaling.x * 6.4, outerDiameter: planet.scaling.x * 7, opacity: 0.3, tessellation: 128 },
                { innerDiameter: planet.scaling.x * 7, outerDiameter: planet.scaling.x * 8, opacity: 0.3, tessellation: 128 }
            ];
        
            ringSettings.forEach((settings, index) => {
                const ring = BABYLON.MeshBuilder.CreateDisc(`ring_${index}`, {
                    radius: settings.outerDiameter / 2,
                    tessellation: settings.tessellation,
                    sideOrientation: BABYLON.Mesh.DOUBLESIDE
                }, scene);
        
                ring.scaling.x = settings.outerDiameter / settings.innerDiameter;
        
                const ringMaterial = new BABYLON.StandardMaterial(`ringMaterial_${index}`, scene);
                ringMaterial.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/razvanpf/Images/main/SaturnRingsCircle.png", scene);
                ringMaterial.diffuseTexture.hasAlpha = true; // Enable transparency in texture
                ringMaterial.backFaceCulling = false; // Ensure both sides are rendered
                ringMaterial.alpha = settings.opacity;
                ringMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1); // Make the ring visible
                ring.material = ringMaterial;
        
                // Rotate the ring to be horizontal and position it correctly
                ring.rotation.x = Math.PI / 2; // Correct rotation for horizontal alignment
                ring.rotation.z = Math.PI; // Flip the ring upside down
                ring.position.y = planet.position.y; // Align with the planet's position
        
                ring.parent = planet; // Attach the ring to Saturn
            });
        };
        
        // After creating all celestial bodies
        celestialBodies.forEach((body) => {
            if (body.data.name === "Saturn") {
                createSaturnRings(scene, body.mesh);
            }
        });
            
        // Add outline on hover for planets
        planet.actionManager = new BABYLON.ActionManager(scene);
        planet.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, function () {
            planet.renderOutline = true;
            planet.outlineWidth = 0.1;
            planet.outlineColor = BABYLON.Color3.White();
        }));
        planet.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, function () {
            planet.renderOutline = false;
        }));

        data.moons.forEach((moonData, moonIndex) => {
            const moon = BABYLON.MeshBuilder.CreateSphere(`moon${index}_${moonIndex}`, { diameter: moonData.size * 2 }, scene);
            const moonMaterial = new BABYLON.StandardMaterial(`moonMaterial${index}_${moonIndex}`, scene);
            moonMaterial.diffuseTexture = new BABYLON.Texture(moonData.texture, scene);
            moon.material = moonMaterial;
            moonMaterial.specularColor = new BABYLON.Color3(0, 0, 0); // Reduce reflectivity
            moon.position = new BABYLON.Vector3(planet.position.x + moonData.distance, 0, planet.position.z);
            moons.push({ mesh: moon, data: moonData, parent: planet, angle: 0 });
            moon.renderingGroupId = 1; // Set the rendering group ID higher than sun rays
    
            // Set initial position of the moon
            moon.position = new BABYLON.Vector3(planet.position.x + moonData.distance, 0, planet.position.z);
            moons.push({ mesh: moon, data: moonData, parent: planet, angle: 0 });
    
            // Add outline on hover for moons
            moon.actionManager = new BABYLON.ActionManager(scene);
            moon.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, function () {
                moon.renderOutline = true;
                moon.outlineWidth = 0.1;
                moon.outlineColor = BABYLON.Color3.White();
            }));
            moon.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, function () {
                moon.renderOutline = false;
            }));
        });
    });

    // Animate planets around the sun
    scene.registerBeforeRender(function () {
        const deltaTime = engine.getDeltaTime() * 0.0001 * speedMultiplier * simulationSpeed; // Add simulationSpeed
    
        celestialBodies.forEach((body) => {
            const distance = body.data.distance;
            const speed = 0.001 / distance; // Adjust speed based on distance
            const angle = (Date.now() * speed * speedMultiplier * simulationSpeed) % (2 * Math.PI); // Counter-clockwise orbit with speedMultiplier and simulationSpeed
            body.mesh.position.x = distance * Math.cos(angle);
            body.mesh.position.z = distance * Math.sin(angle);
    
            // Rotation around own axis
            if (body.data.name === "Venus") {
                body.mesh.rotation.y += body.data.rotationSpeed * simulationSpeed * 0.1; // Clockwise rotation
            } else if (body.data.name === "Uranus") {
                body.mesh.rotation.z += body.data.rotationSpeed * simulationSpeed * 0.1; // Rolling rotation
            } else {
                body.mesh.rotation.y -= body.data.rotationSpeed * simulationSpeed * 0.1; // Counter-clockwise rotation
            }
        });
    
        // Animate moons around their planets
        moons.forEach((moon) => {
            const distance = moon.data.distance;
            const speed = 0.001 / distance; // Adjust speed based on distance
            const angle = (Date.now() * speed * speedMultiplier * simulationSpeed) % (2 * Math.PI); // Counter-clockwise orbit with speedMultiplier and simulationSpeed
            moon.mesh.position.x = moon.parent.position.x + distance * Math.cos(angle);
            moon.mesh.position.z = moon.parent.position.z + distance * Math.sin(angle);
    
            // Rotation around own axis
            moon.mesh.rotation.y -= moon.data.rotationSpeed * simulationSpeed * 0.1; // Counter-clockwise rotation
        });
    });

    // Spaceship
    let spaceship;
    BABYLON.SceneLoader.ImportMesh("", "https://models.babylonjs.com/", "ufo.glb", scene, function (meshes) {
        spaceship = meshes[0];
        spaceship.scaling = new BABYLON.Vector3(1, 1, 1); // Slightly bigger
        spaceship.position = new BABYLON.Vector3(0, -15, 0);
        // Set the initial position of the spaceship
        const initialX = 15; // Move it to the left of the sun
        const initialY = 0;    // Align with the orbit plane
        const initialZ = 0;    // Same plane as the orbit rings
        spaceship.checkCollisions = true; // Enable collision detection for the spaceship
        spaceship.ellipsoid = new BABYLON.Vector3(1, 1, 1);
        spaceship.ellipsoidOffset = new BABYLON.Vector3(0, 1, 0);

        spaceship.position = new BABYLON.Vector3(initialX, initialY, initialZ);

        // Create a light and attach it to the spaceship
        const shipLight = new BABYLON.PointLight("shipLight", new BABYLON.Vector3(0, 5, 0), scene);
        shipLight.intensity = 2; // Adjust the intensity to make the spaceship visible
        shipLight.parent = spaceship;

        // Ensure the light is positioned slightly above the spaceship
        shipLight.position = new BABYLON.Vector3(0, 5, 0); // 5 units above the spaceship

        // Fiery Trail
        const particleSystem = new BABYLON.ParticleSystem("particles", 2000, scene);
        particleSystem.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
        particleSystem.emitter = spaceship;
        particleSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
        particleSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0, 0.5);

        particleSystem.color1 = new BABYLON.Color4(1, 0.5, 0, 1.0);
        particleSystem.color2 = new BABYLON.Color4(1, 0, 0, 1.0);
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.5;

        particleSystem.minLifeTime = 0.3;
        particleSystem.maxLifeTime = 1.5;

        particleSystem.emitRate = 500;

        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

        particleSystem.gravity = new BABYLON.Vector3(0, 0, 0);

        particleSystem.direction1 = new BABYLON.Vector3(-1, -1, -1);
        particleSystem.direction2 = new BABYLON.Vector3(1, -1, 1);

        particleSystem.minAngularSpeed = 0;
        particleSystem.maxAngularSpeed = Math.PI;

        particleSystem.minEmitPower = 1;
        particleSystem.maxEmitPower = 3;
        particleSystem.updateSpeed = 0.005;

        particleSystem.start();

        // Event listener for canvas click
        let isDragging = false;
        let mouseDown = false;
        let lastPickedMesh = null; // Store the last picked mesh

        canvas.addEventListener("mousedown", function (evt) {
            mouseDown = true;
            isDragging = false;
        });

        canvas.addEventListener("mousemove", function (evt) {
            if (mouseDown) {
                isDragging = true;
            }
        });

        canvas.addEventListener("mouseup", function (evt) {
            mouseDown = false;
            if (!isDragging) {
                handleCanvasClick(evt);
            }
            isDragging = false;
        });

        function handleCanvasClick(evt) {
            pickResult = scene.pick(evt.clientX, evt.clientY);
            if (pickResult.hit && pickResult.pickedMesh) {
                targetPosition = pickResult.pickedPoint;
                spaceship.lookAt(targetPosition);
                particleSystem.start();

                // Detach the ship from the planet when a new target is selected
                detachShipFromPlanet(spaceship);

                // Reset the hasArrived flag
                hasArrived = false;

                // Zoom out without smooth transition
                camera.radius += 20;

                // Check if the target is a planet, moon, or sun
                if (pickResult.pickedMesh.name.startsWith("planet") || pickResult.pickedMesh.name.startsWith("moon") || pickResult.pickedMesh.name === "sun") {
                    lastPickedMesh = pickResult.pickedMesh; // Store the last picked mesh
                    startUpdatingTargetPosition(pickResult.pickedMesh);
                } else {
                    lastPickedMesh = null; // Clear last picked mesh for unrecognized bodies
                    stopUpdatingTargetPosition();
                }
            }
        }

        // This click event ensures that handleCanvasClick is only called if there was no dragging
        canvas.addEventListener("click", function (evt) {
            if (!isDragging) {
                handleCanvasClick(evt);
            }
        });

        // Function to handle arrival and trigger popup
        function onArrival() {
            if (lastPickedMesh) {
                camera.setTarget(lastPickedMesh.position);
                showPopup(lastPickedMesh);
                lastPickedMesh = null; // Clear the last picked mesh after triggering the popup
            }
        }

        // Update your moveToTarget function to use onArrival callback
        function moveToTarget(targetPosition, onArrivalCallback) {
            targetPosition = targetPosition.clone(); // Clone to avoid modifying the original target position
            const speed = 0.4; // Adjust the speed as needed
            scene.registerBeforeRender(function moveShip() {
                const direction = targetPosition.subtract(spaceship.position).normalize();
                spaceship.position.addInPlace(direction.scale(speed)); // Adjust the speed as needed
        
                if (BABYLON.Vector3.Distance(spaceship.position, targetPosition) < 0.1) {
                    scene.unregisterBeforeRender(moveShip); // Stop moving the ship
                    if (onArrivalCallback) {
                        onArrivalCallback(); // Trigger the callback on arrival
                    }
                }
            });
        }

        // Attach Ship function
        function attachShipToPlanet(ship, planet) {
            ship.parent = planet;
            ship.position = BABYLON.Vector3.Zero(); // Reset the ship's position relative to the planet
        }

        // Detach ship function
        function detachShipFromPlanet(ship) {
            if (ship.parent) {
                const worldMatrix = ship.getWorldMatrix();
                const worldPosition = BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Zero(), worldMatrix);
                ship.parent = null;
                ship.position = worldPosition;
            }
        }

        // Function to handle spaceship movement and camera focus
        scene.registerBeforeRender(function () {
            if (targetPosition) {
                const direction = targetPosition.subtract(spaceship.position).normalize();
                spaceship.moveWithCollisions(direction.scale(0.1));
                if (BABYLON.Vector3.Distance(spaceship.position, targetPosition) < 0.1 && !hasArrived) {
                    stopUpdatingTargetPosition();
                    targetPosition = null;
                    particleSystem.stop();
                    hasArrived = true; // Set the flag to indicate arrival
                    if (lastPickedMesh && lastPickedMesh.name.startsWith("planet")) {
                        attachShipToPlanet(spaceship, lastPickedMesh);
                        setTimeout(() => {
                            camera.setTarget(lastPickedMesh.position); // Set camera focus to the planet
                            lightUpPlanet(lastPickedMesh); // Light up the planet
                            showPopup(lastPickedMesh);
                        }, 1000); // Add a delay before focusing on the planet
                    } else if (lastPickedMesh && lastPickedMesh.name.startsWith("moon")) {
                        setTimeout(() => {
                            attachShipToPlanet(spaceship, lastPickedMesh);
                            camera.setTarget(lastPickedMesh.position); // Set camera focus to the moon
                            lightUpPlanet(lastPickedMesh); // Light up the moon
                            showPopup(lastPickedMesh);
                        }, 1000); // Add a delay before focusing on the moon
                    } else if (lastPickedMesh && lastPickedMesh.name === "sun") {
                        setTimeout(() => {
                            camera.setTarget(lastPickedMesh.position); // Set camera focus to the sun
                            lightUpPlanet(lastPickedMesh); // Light up the sun
                            showPopup(lastPickedMesh);
                        }, 1000); // Add a delay before focusing on the sun
                    } else {
                        // Reset camera to sun if empty space is clicked
                        camera.setTarget(BABYLON.Vector3.Zero());
                        if (planetLight) {
                            planetLight.dispose();
                            planetLight = null;
                            currentLitPlanet = null;
                        }
                    }
                }
            }
        });
    });

    // Background
    scene.clearColor = new BABYLON.Color3(0, 0, 0);

    // Twinkling Stars
    const starParticles = new BABYLON.ParticleSystem("stars", 1000, scene);
    starParticles.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
    starParticles.emitter = new BABYLON.Vector3(0, 0, 0);

    // Define the boundaries of the scene
    const innerBoundary = 50; // Distance from the center where stars should not spawn
    const outerBoundary = 100; // Distance from the center where stars can spawn

    // Custom particle emitter function to control particle positions
    starParticles.startPositionFunction = function(worldMatrix, positionToUpdate) {
        let distanceFromCenter;
        do {
            // Random position within the outer boundaries
            positionToUpdate.x = Math.random() * 2 * outerBoundary - outerBoundary;
            positionToUpdate.y = Math.random() * 2 * outerBoundary - outerBoundary;
            positionToUpdate.z = Math.random() * 2 * outerBoundary - outerBoundary;

            // Calculate distance from the center of the scene
            distanceFromCenter = Math.sqrt(
                positionToUpdate.x * positionToUpdate.x +
                positionToUpdate.y * positionToUpdate.y +
                positionToUpdate.z * positionToUpdate.z
            );
        } while (distanceFromCenter < innerBoundary); // Repeat until the position is outside the inner boundary
    };

    starParticles.color1 = new BABYLON.Color4(1, 1, 1, 1.0);
    starParticles.color2 = new BABYLON.Color4(0.8, 0.8, 1, 1.0);
    starParticles.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

    starParticles.minSize = 0.1;
    starParticles.maxSize = 0.5;

    starParticles.minLifeTime = Number.MAX_SAFE_INTEGER; // Infinite life time
    starParticles.maxLifeTime = Number.MAX_SAFE_INTEGER;

    starParticles.emitRate = 1000;

    starParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

    starParticles.gravity = new BABYLON.Vector3(0, 0, 0);

    starParticles.direction1 = new BABYLON.Vector3(0, 0, 0);
    starParticles.direction2 = new BABYLON.Vector3(0, 0, 0);

    starParticles.updateSpeed = 0.005;

    starParticles.start();

    function lightUpPlanet(planet) {
        if (currentLitPlanet) {
            console.log(`Current lit planet: ${currentLitPlanet.name}`);
        } else {
            console.log(`No planet is currently lit.`);
        }

        // If there is a currently lit planet, turn off its light
        if (currentLitPlanet && planetLight) {
            planetLight.dispose();
            planetLight = null;
        }

        // Create a new hemispheric light for the visited planet
        planetLight = new BABYLON.HemisphericLight(`planetLight_${planet.name}`, new BABYLON.Vector3(0, 1, 0), scene);
        planetLight.intensity = 1.5;
        planetLight.parent = planet;

        // Ensure the light ffects the visited planet
        planetLight.includedOnlyMeshes = [planet];

        // Update the current lit planet
        currentLitPlanet = planet;
    }

    function showPopup(mesh) {
        const popup = document.getElementById("popup");
        popup.style.display = "block";

        const planetDescriptions = {
            "Mercury": {
                name: "Mercury",
                description: "The smallest planet in this solar system and nearest to the star Sol. From the surface of Mercury, the star would appear more than three times as large as it does when viewed from Earth, and the sunlight would be as much as seven times brighter.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Mercury2d.png"
            },
            "Venus": {
                name: "Venus",
                description: "Venus is the second planet from Sol, and the sixth largest planet. It is the hottest planet in this solar system. Venus is a cloud-swaddled planet named for a love goddess of Earthling religion, and often called the twin of Earth. But pull up a bit closer, and Venus turns hellish.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Venus2d.png"
            },
            "Earth": {
                name: "Earth",
                description: "Earth is rounded into an ellipsoid with a circumference of about 40,000 km. It is the densest planet in the Solar System. Of the four rocky planets, it is the largest and most massive. Earth is about eight light-minutes away from the Sun and orbits it, taking a year (about 365.25 days) to complete one revolution.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Earth2d.png"
            },
            "Mars": {
                name: "Mars",
                description: "Dry, rocky, and bitter cold. The fourth planet from the Sol, Mars, is one of the two closest planetary neighbors to Earth (Venus is the other). Mars is one of the easiest planets to spot in the night sky – it looks like a bright red point of light from Earth. Earthlings are trying to make this planet habitable for them.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Mars2d.png"
            },
            "Jupiter": {
                name: "Jupiter",
                description: "Jupiter is a world of extremes. It is the largest planet in this solar system – if it were a hollow shell, 1,000 Earths could fit inside. It is also the oldest planet, forming from the dust and gases left over from the formation of the solar system 4.5 billion years ago.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/jupiter2d.png"
            },
            "Saturn": {
                name: "Saturn",
                description: "Saturn is the sixth planet from the Sun and the second largest planet in the solar system. Adorned with a dazzling system of icy rings, Saturn is unique among the planets. It is not the only planet to have rings, but none are as spectacular or as complex.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Saturn2dv2.png"
            },
            "Uranus": {
                name: "Uranus",
                description: "Uranus is a very cold and windy world. The ice giant is surrounded by 13 faint rings and 28 small moons. Uranus rotates at a nearly 90-degree angle from the plane of its orbit. This unique tilt makes Uranus appear to spin sideways, orbiting the star like a rolling ball.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Uranus2d.png"
            },
            "Neptune": {
                name: "Neptune",
                description: "Neptune is one of two ice giants in the outer solar system. The mass of the planet Most (80% or more) is made up of a hot dense fluid of icy materials – water, methane, and ammonia – above a small, rocky core. Of the giant planets, Neptune is the densest. Maybe we can extract some resources here?",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Neptune2d.png"
            },
            "Sun": {
                name: "Sun",
                description: "The Sol system star, located at the center of the solar system, about 150 million kilometers from Earth and this system's only star. Without the star's energy, inhabitants of planet Earth could not exist.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Sun2d.png"
            },
            "Moon": {
                name: "Moon",
                description: "The Moon is Earth's only natural satellite. It is the fifth largest satellite in the Solar System, and by far the largest among planetary satellites relative to the size of the planet that it orbits.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Moon2D.png"
            },
            "Phobos": {
                name: "Phobos",
                description: "Phobos is the innermost and larger of the two natural satellites of Mars. Phobos is a small, irregularly shaped object with a mean radius of 11 km.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Phobos2D.png"
            },
            "Deimos": {
                name: "Deimos",
                description: "Deimos is the smaller and outermost of the two natural satellites of the planet Mars, with a mean radius of 6.2 km.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Deimos2D.png"
            },
            "Io": {
                name: "Io",
                description: "Io is the innermost of the four Galilean moons of the planet Jupiter and, with a diameter of 3,643.2 km, the fourth-largest moon in the Solar System.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/IO2D.png"
            },
            "Europa": {
                name: "Europa",
                description: "Europa is the smallest of the four Galilean moons orbiting Jupiter, and the sixth-closest to the planet.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Europa2D.png"
            },
            "Ganymede": {
                name: "Ganymede",
                description: "Ganymede is the largest and most massive moon of Jupiter and in the Solar System. It is the ninth largest object in the Solar System.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Ganymede2D.png"
            },
            "Callisto": {
                name: "Callisto",
                description: "Callisto is the second-largest moon of Jupiter, after Ganymede. It is the third-largest moon in the Solar System.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Callisto2D.png"
            },
            "Titan": {
                name: "Titan",
                description: "Titan is the largest moon of Saturn and the second-largest natural satellite in the Solar System. It is the only moon known to have a dense atmosphere.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Titan2D.png"
            },
            "Titania": {
                name: "Titania",
                description: "Titania is the largest of the moons of Uranus and the eighth largest moon in the Solar System at a diameter of 1,578 kilometres (981 mi).",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Titania2D.png"
            },
            "Oberon": {
                name: "Oberon",
                description: "Oberon is the second largest moon of Uranus. It was discovered by William Herschel on 11 January 1787, the same day he discovered Uranus' largest moon, Titania.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Oberon2D.png"
            },
            "Miranda": {
                name: "Miranda",
                description: "Miranda is the smallest and innermost of Uranus's five round satellites and is the fifth largest moon of Uranus, with a mean diameter of 471.6 km.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Miranda2D.png"
            },
            "Triton": {
                name: "Triton",
                description: "Triton is the largest natural satellite of the planet Neptune. It is the only large moon in the Solar System with a retrograde orbit.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Triton2D.png"
            }
        };

        const meshNameToPlanetName = {
            "planet0": "Mercury",
            "planet1": "Venus",
            "planet2": "Earth",
            "planet3": "Mars",
            "planet4": "Jupiter",
            "planet5": "Saturn",
            "planet6": "Uranus",
            "planet7": "Neptune",
            "sun": "Sun",
            "moon0_0": "Moon",
            "moon2_0": "Moon",
            "moon3_0": "Phobos",
            "moon3_1": "Deimos",
            "moon4_0": "Io",
            "moon4_1": "Europa",
            "moon4_2": "Ganymede",
            "moon4_3": "Callisto",
            "moon5_0": "Titan",
            "moon6_0": "Titania",
            "moon6_1": "Oberon",
            "moon6_2": "Miranda",
            "moon7_0": "Triton"
        };

        const planetName = meshNameToPlanetName[mesh.name];
        const planetInfo = planetDescriptions[planetName] || {};

        const info = `
            <div style="text-align: center;">
                <h1>You discovered</h1>
                <h2>${planetInfo.name || mesh.name}</h2>
                <img src="${planetInfo.image || ''}" alt="${planetInfo.name || mesh.name}" style="width: 100px; height: 100px;">
                <p>${planetInfo.description || ''}</p>
                Age: ${planetName === "Sun" ? "4.6 billion years" : "4.5 billion years"}<br>
                Mass: ${planetName === "Sun" ? "1.989 × 10^30 kg" : "5.972 × 10^24 kg"}<br>
                Atmosphere: ${planetName === "Sun" ? "Hydrogen, Helium" : "Nitrogen, Oxygen"}<br>
                Diameter: ${planetName === "Sun" ? "1.391 million km" : "12,742 km"}<br>
                Gravity: ${planetName === "Sun" ? "274 m/s²" : "9.8 m/s²"}<br>
                <button id="continueBtn" style="background-color: transparent; color: white; padding: 10px 20px; border: 2px solid blue; border-radius: 5px; cursor: pointer; margin-top: 20px;">
                    Continue exploration
                </button>
            </div>
        `;
        popup.innerHTML = info;

        document.getElementById("continueBtn").addEventListener("click", function () {
            popup.style.display = "none";
        });
    }

    // Prevent default right-click context menu
    window.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });

    // Function to disable right-click drag behavior
    const disableRightClickDrag = () => {
        canvas.oncontextmenu = (e) => {
            e.preventDefault();
        };

        // Remove right-click event listeners
        canvas.removeEventListener("mousedown", onRightMouseDown);
        canvas.removeEventListener("mouseup", onRightMouseUp);
        canvas.removeEventListener("mousemove", onRightMouseMove);
    };

    const onRightMouseDown = (event) => {
        if (event.button === 2) { // Right mouse button
            event.preventDefault();
        }
    };

    const onRightMouseUp = (event) => {
        if (event.button === 2) { // Right mouse button
            event.preventDefault();
        }
    };

    const onRightMouseMove = (event) => {
        if (event.button === 2) { // Right mouse button
            event.preventDefault();
        }
    };

    // Add event listeners to disable right-click drag
    canvas.addEventListener("mousedown", onRightMouseDown);
    canvas.addEventListener("mouseup", onRightMouseUp);
    canvas.addEventListener("mousemove", onRightMouseMove);

    // Call the function to disable right-click drag behavior
    disableRightClickDrag();

    return scene;
};


// Updated URL in loadModel function
const asteroidUrl = "https://raw.githubusercontent.com/razvanpf/Images/main/Asteroid2.glb";

// Handle window resize
window.addEventListener("resize", () => {
    engine.resize();
});
// Show the welcome popup and hide the controls initially
window.onload = () => {
    const welcomePopup = document.getElementById('welcomePopup');
    const welcomeBtn = document.getElementById('welcomeBtn');
    const controlsDiv = document.getElementById('speedSliderContainer');

    welcomePopup.style.display = 'flex';
    controlsDiv.style.display = 'none';

    welcomeBtn.addEventListener('click', function () {
        welcomePopup.style.display = 'none';
        controlsDiv.style.display = 'flex'; // Show controls after closing the welcome popup
    });
};

function animateCameraToTarget(camera, target, onComplete) {
    const animation = new BABYLON.Animation("cameraAnimation", "position", 60, BABYLON.Animation.ANIMATIONTYPE_VECTOR3, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    const keys = [
        { frame: 0, value: camera.position },
        { frame: 60, value: target }
    ];
    animation.setKeys(keys);
    camera.animations.push(animation);
    scene.beginAnimation(camera, 0, 60, false, 1, onComplete);
}

// Main code to create and render the scene
const scene = createScene();

// Adjust the render loop to consider the simulation speed
let lastTime = performance.now();

engine.runRenderLoop(() => {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) * simulationSpeed;
    lastTime = currentTime;

    scene.render();
});

// Welcome Popup:
window.addEventListener("load", function () {
    // Display the welcome popup
    const welcomePopup = document.getElementById("welcomePopup");
    const welcomeBtn = document.getElementById("welcomeBtn");

    welcomePopup.style.display = "block";

    // Apply blur to the background
    const mainContent = document.getElementById("renderCanvas");
    mainContent.style.filter = "blur(5px)";

    // Close the popup and remove blur
    welcomeBtn.addEventListener("click", function () {
        welcomePopup.style.display = "none";
        mainContent.style.filter = "none";
        document.getElementById("controls").style.display = 'flex'; // Show the controls once the welcome popup is closed
    });
});

// Function to start updating target position
function startUpdatingTargetPosition(planet) {
    if (intervalId) {
        clearInterval(intervalId);
    }
    intervalId = setInterval(() => {
        targetPosition = planet.position.clone();
    }, updateInterval);
    hasArrived = false; // Reset the flag when starting to update target position
}

// Function to stop updating target position
function stopUpdatingTargetPosition() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

// DYNAMIC EVENTS - SOLAR FLARE
////////////////////////////////////

function createSolarFlare(scene, sun) {
    const flareSystem = new BABYLON.ParticleSystem("flare", 1000, scene); // Reduced number of particles
    flareSystem.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);

    flareSystem.minEmitBox = new BABYLON.Vector3(-2, -2, -2); // Smaller emit box
    flareSystem.maxEmitBox = new BABYLON.Vector3(2, 2, 2);

    flareSystem.color1 = new BABYLON.Color4(1, 0.6, 0, 1.0);
    flareSystem.color2 = new BABYLON.Color4(1, 0.3, 0, 1.0);
    flareSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

    flareSystem.minSize = 0.7; // Slightly increased size
    flareSystem.maxSize = 2.0;

    flareSystem.minLifeTime = 0.2;
    flareSystem.maxLifeTime = 0.5; // Reduced lifetime

    flareSystem.emitRate = 100; // Reduced emit rate

    flareSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

    flareSystem.gravity = new BABYLON.Vector3(0, 0, 0);

    flareSystem.direction1 = new BABYLON.Vector3(-1, -1, -1);
    flareSystem.direction2 = new BABYLON.Vector3(1, 1, 1);

    flareSystem.minAngularSpeed = 0;
    flareSystem.maxAngularSpeed = Math.PI;

    flareSystem.minEmitPower = 2;
    flareSystem.maxEmitPower = 5;
    flareSystem.updateSpeed = 0.01;

    return flareSystem;
}

// Add the solar flare effect
const flareSystem = createSolarFlare(scene, sun);

// Function to randomize the emitter position
function randomizeEmitterPosition(flareSystem, sun) {
    const positions = [
        new BABYLON.Vector3(sun.position.x + 10.5, sun.position.y, sun.position.z), // Right
        new BABYLON.Vector3(sun.position.x - 10.5, sun.position.y, sun.position.z), // Left
        new BABYLON.Vector3(sun.position.x, sun.position.y + 10.5, sun.position.z)  // North
    ];
    const randomIndex = Math.floor(Math.random() * positions.length);
    flareSystem.emitter = positions[randomIndex];
}

// Function to trigger the solar flare
function triggerSolarFlare() {
    randomizeEmitterPosition(flareSystem, sun);
    flareSystem.start();
    setTimeout(() => {
        flareSystem.stop();
    }, 1000); // Flare lasts for 1 second
}

// Test the solar flare 10 seconds after loading the page
setTimeout(triggerSolarFlare, 10000);

// Function to handle random dynamic events
function randomEvent() {
    const randomTime = Math.random() * 60000; // Random time between 0 and 60 seconds
    setTimeout(() => {
        triggerSolarFlare();
        randomEvent(); // Schedule the next random event
    }, randomTime);
}
// DYNAMIC EVENTS - COMET PASSING BY
////////////////////////////////////
let activeComet = null; // Variable to track the active comet

// Function to create the comet with asteroid mesh and blue tint
async function createComet(scene) {
    if (activeComet) {
        console.log("Active comet already exists.");
        return null; // Return if there's already an active comet
    }

    try {
        // Load the asteroid mesh
        const comet = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            "https://raw.githubusercontent.com/razvanpf/Images/main/Asteroid2.glb",
            "",
            scene
        );

        const cometMesh = comet.meshes[0];
        cometMesh.scaling = new BABYLON.Vector3(0.025, 0.025, 0.025); // Adjust size to half

        const cometMaterial = new BABYLON.StandardMaterial("cometMaterial", scene);
        cometMaterial.diffuseTexture = new BABYLON.Texture("https://raw.githubusercontent.com/razvanpf/Images/main/2k_mars.jpg", scene); // Asteroid texture URL
        cometMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 1); // Blue tint
        cometMesh.material = cometMaterial;

        // Create the particle system for the comet's tail
        const tailSystem = new BABYLON.ParticleSystem("cometTail", 2000, scene);
        tailSystem.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);

        tailSystem.minEmitBox = new BABYLON.Vector3(-1, 0, 0); // Starting point
        tailSystem.maxEmitBox = new BABYLON.Vector3(1, 0, 0);  // Ending point

        tailSystem.color1 = new BABYLON.Color4(0.5, 0.5, 1, 1.0);
        tailSystem.color2 = new BABYLON.Color4(0.2, 0.2, 0.8, 1.0);
        tailSystem.colorDead = new BABYLON.Color4(0, 0, 1, 0.0);

        tailSystem.minSize = 0.4;
        tailSystem.maxSize = 0.6;

        tailSystem.minLifeTime = 0.5;
        tailSystem.maxLifeTime = 1;

        tailSystem.emitRate = 5000;

        tailSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

        tailSystem.gravity = new BABYLON.Vector3(0, 0, 0);

        tailSystem.direction1 = new BABYLON.Vector3(-1, 2, -1);
        tailSystem.direction2 = new BABYLON.Vector3(1, 2, 1);

        tailSystem.minAngularSpeed = 0;
        tailSystem.maxAngularSpeed = Math.PI;

        tailSystem.minEmitPower = 2;
        tailSystem.maxEmitPower = 6;
        tailSystem.updateSpeed = 0.01;

        tailSystem.emitter = cometMesh; // Attach the tail to the comet
        tailSystem.start();

        activeComet = cometMesh;
        console.log("Comet created");
        return cometMesh;
    } catch (error) {
        console.error("Error creating comet:", error);
        return null;
    }
}

// Function to animate the comet through the solar system
function animateComet(comet, scene) {
    if (!comet || !scene) {
        console.error("Comet or scene is not defined");
        return;
    }

    const distance = 300;

    // Ensure the comet travels horizontally through the solar system
    const startX = Math.random() < 0.5 ? -distance : distance;
    const startY = (Math.random() * 20) - 10; // Small vertical variation
    const startZ = (Math.random() * 40) - 20; // Small depth variation

    const endX = -startX;
    const endY = (Math.random() * 20) - 10; // Small vertical variation
    const endZ = (Math.random() * 40) - 20; // Small depth variation

    const startPosition = new BABYLON.Vector3(startX, startY, startZ);
    const endPosition = new BABYLON.Vector3(endX, endY, endZ);

    comet.position = startPosition;

    const animation = new BABYLON.Animation(
        "cometAnimation",
        "position",
        30,
        BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const keys = [
        { frame: 0, value: startPosition },
        { frame: 300, value: endPosition } // Adjust frame count for speed
    ];

    animation.setKeys(keys);
    comet.animations = [];
    comet.animations.push(animation);

    scene.beginDirectAnimation(comet, [animation], 0, 300, false, 1, () => {
        comet.dispose(); // Remove comet after animation
        activeComet = null; // Reset the active comet
        console.log("Comet animation completed and disposed");
    });

    console.log("Comet animation started from", startPosition, "to", endPosition);
}

// Function to trigger the comet event
async function triggerCometEvent() {
    if (activeComet) {
        console.log("An active comet is already present.");
        return; // Return if there's already an active comet
    }
    const comet = await createComet(scene);
    if (comet) {
        animateComet(comet, scene);
        console.log("Comet event triggered");
    }
}

// Function to handle random dynamic events
function randomEvent() {
    const randomTime = 20000; // 20 seconds
    setTimeout(() => {
        if (!activeComet) {
            triggerCometEvent();
        }
        randomEvent(); // Schedule the next random event
    }, randomTime);
}

// Start the random events
randomEvent();

// Add this function to update the text
function updateSliderText(value) {
    const speedFactor = (value / 100) * 0.9 + 0.1; // Same mapping formula
    const speedText = speedFactor.toFixed(1) + "x"; // Format to 1 decimal place
    document.getElementById("speedDisplay").innerText = speedText;
}
