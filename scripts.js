const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
const updateInterval = 100; // Update every 100 milliseconds
let hasArrived = false; // Flag to track if the spaceship has arrived

let targetPosition = null;
let pickResult = null;
let currentLitPlanet = null;
let planetLight = null;
let intervalId = null;

const createScene = function () {
    const scene = new BABYLON.Scene(engine);

    // Camera
    const camera = new BABYLON.ArcRotateCamera("camera1", Math.PI / 2, Math.PI / 4, 30, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.upperRadiusLimit = 120;
    camera.lowerRadiusLimit = 5;
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = Math.PI / 2 - 0.1;
    camera.radius = camera.upperRadiusLimit; // Start zoomed out

    // Light
    const light = new BABYLON.PointLight("light", new BABYLON.Vector3(0, 0, 0), scene);
    light.intensity = 3;

    // Sun
    const sun = BABYLON.MeshBuilder.CreateSphere("sun", { diameter: 10 }, scene);
    const sunMaterial = new BABYLON.StandardMaterial("sunMaterial", scene);
    sunMaterial.emissiveTexture = new BABYLON.Texture("https://raw.githubusercontent.com/razvanpf/Images/main/2ksun.jpg", scene);
    sunMaterial.disableLighting = true;
    sun.material = sunMaterial;
    sun.position = new BABYLON.Vector3(0, 0, 0);

    // Glow Layer
    const glowLayer = new BABYLON.GlowLayer("glow", scene);
    glowLayer.intensity = 1.5;
    glowLayer.addIncludedOnlyMesh(sun);


    // Add outline on hover for the sun
    sun.actionManager = new BABYLON.ActionManager(scene);
    sun.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, function () {
        sun.renderOutline = true;
        sun.outlineWidth = 0.1;
        sun.outlineColor = BABYLON.Color3.White();
    }));
    sun.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, function () {
        sun.renderOutline = false;
    }));

    // Sun Rotation
    scene.registerBeforeRender(() => {
        sun.rotation.y += 0.001;
    });

    // Planets and Moons Data
    const celestialData = [
        { 
            name: "Mercury", 
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_mercury.jpg", 
            size: 1, 
            distance: 20, 
            orbitSpeed: 0.01, 
            moons: [] 
        },
        { 
            name: "Venus", 
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_venus_atmosphere.jpg", 
            size: 1.2, 
            distance: 30, 
            orbitSpeed: 0.008, 
            moons: [] 
        },
        { 
            name: "Earth", 
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2kearth.jpg", 
            size: 1.3, 
            distance: 40, 
            orbitSpeed: 0.006, 
            moons: [
                { name: "Moon", size: 0.3, distance: 3, orbitSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2kmoon.jpg" }
            ] 
        },
        { 
            name: "Mars", 
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_mars.jpg", 
            size: 1.1, 
            distance: 50, 
            orbitSpeed: 0.005, 
            moons: [
                { name: "Phobos", size: 0.1, distance: 2, orbitSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2kphobos.jpg" },
                { name: "Deimos", size: 0.1, distance: 3, orbitSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2kdeimos.jpg" }
            ] 
        },
        { 
            name: "Jupiter", 
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_jupiter.jpg", 
            size: 2, 
            distance: 70, 
            orbitSpeed: 0.004, 
            moons: [
                { name: "Io", size: 0.3, distance: 4, orbitSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2kio.jpg" },
                { name: "Europa", size: 0.3, distance: 5, orbitSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2keuropa.jpg" },
                { name: "Ganymede", size: 0.3, distance: 6, orbitSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2kganymede.jpg" },
                { name: "Callisto", size: 0.3, distance: 7, orbitSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2kcallisto.jpg" }
            ] 
        },
        { 
            name: "Saturn", 
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_saturn.jpg", 
            size: 1.8, 
            distance: 90, 
            orbitSpeed: 0.003, 
            moons: [
                { name: "Titan", size: 0.4, distance: 5, orbitSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2ktitan.jpg" }
            ] 
        },
        { 
            name: "Uranus", 
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2k_uranus.jpg", 
            size: 1.5, 
            distance: 110, 
            orbitSpeed: 0.002, 
            moons: [] 
        },
        { 
            name: "Neptune", 
            texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2kneptune.jpg", 
            size: 1.4, 
            distance: 130, 
            orbitSpeed: 0.001, 
            moons: [
                { name: "Triton", size: 0.4, distance: 5, orbitSpeed: 0.02, texture: "https://raw.githubusercontent.com/razvanpf/Images/main/2ktriton.jpg" }
            ] 
        }
    ];
    const createRings = (scene) => {
        celestialData.forEach((data, index) => {
            //Create orbit ring with higher tessellation
            const orbit = BABYLON.MeshBuilder.CreateTorus(`orbit${index}`, { diameter: data.distance * 2, thickness: 0.05, tessellation: 128 }, scene);
            const orbitMaterial = new BABYLON.StandardMaterial(`orbitMaterial${index}`, scene);
            orbitMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
            orbitMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
            orbitMaterial.alpha = 0.5; // Set the opacity to 50%
            orbit.material = orbitMaterial;
        });
    };
    

    const celestialBodies = [];
    const moons = [];

    celestialData.forEach((data, index) => {
        // Create orbit ring
        //const orbit = BABYLON.MeshBuilder.CreateTorus(`orbit${index}`, { diameter: data.distance * 2, thickness: 0.05 }, scene);
        //const orbitMaterial = new BABYLON.StandardMaterial(`orbitMaterial${index}`, scene);
        //orbitMaterial.diffuseColor = BABYLON.Color3.White();
        //orbitMaterial.emissiveColor = BABYLON.Color3.White();
        //orbit.material = orbitMaterial;

        // Create planet
        const planet = BABYLON.MeshBuilder.CreateSphere(`planet${index}`, { diameter: data.size }, scene);
        const planetMaterial = new BABYLON.StandardMaterial(`planetMaterial${index}`, scene);
        planetMaterial.diffuseTexture = new BABYLON.Texture(data.texture, scene);
        planet.material = planetMaterial;
        planetMaterial.specularColor = new BABYLON.Color3(0, 0, 0); // Reduce reflectivity

        // Create rings
        createRings(scene);

        // Set initial position of the planet
        planet.position = new BABYLON.Vector3(data.distance, 0, 0);
        celestialBodies.push({ mesh: planet, data });
        

        // Set initial position of the planet
        planet.position = new BABYLON.Vector3(data.distance, 0, 0);
        celestialBodies.push({ mesh: planet, data });

        // Create rings around Saturn
        const createSaturnRings = (scene, planet) => {
            const ringSettings = [
                { innerDiameter: planet.scaling.x * 2.8, outerDiameter: planet.scaling.x * 3.2, opacity: 0.4, tessellation: 128 },
                { innerDiameter: planet.scaling.x * 3.2, outerDiameter: planet.scaling.x * 3.5, opacity: 0.3, tessellation: 128 },
                { innerDiameter: planet.scaling.x * 3.5, outerDiameter: planet.scaling.x * 4, opacity: 0.3, tessellation: 128 }
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
        
                // Debug statements
                console.log(`Created ring ${index} with inner diameter ${settings.innerDiameter}, outer diameter ${settings.outerDiameter}, and opacity ${settings.opacity}`);
                console.log(`Ring ${index} rotation: ${ring.rotation.toString()}`);
                console.log(`Ring ${index} parent position: ${ring.parent.position.toString()}`);
                console.log(`Ring ${index} scale: ${ring.scaling.toString()}`);
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

        // Planet Rotation
        scene.registerBeforeRender(() => {
            planet.rotation.y += 0.001;
        });

        data.moons.forEach((moonData, moonIndex) => {
            const moon = BABYLON.MeshBuilder.CreateSphere(`moon${index}_${moonIndex}`, { diameter: moonData.size }, scene);
            const moonMaterial = new BABYLON.StandardMaterial(`moonMaterial${index}_${moonIndex}`, scene);
            moonMaterial.diffuseTexture = new BABYLON.Texture(moonData.texture, scene);
            moon.material = moonMaterial;
            moonMaterial.specularColor = new BABYLON.Color3(0, 0, 0); // Reduce reflectivity
    
            // Set initial position of the moon
            moon.position = new BABYLON.Vector3(planet.position.x + moonData.distance, 0, planet.position.z);
            moons.push({ mesh: moon, data: moonData, parent: planet });
    
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
    
            // Moon Rotation
            scene.registerBeforeRender(() => {
                moon.rotation.y += 0.001;
            });
        });
    });

    // Animate planets around the sun
    scene.registerBeforeRender(function () {
        const deltaTime = engine.getDeltaTime() * 0.0001;
        celestialBodies.forEach((body) => {
            const distance = body.data.distance;
            const speed = 0.001 / distance; // Adjust speed based on distance
            const angle = (Date.now() * speed) % (2 * Math.PI);
            body.mesh.position.x = distance * Math.cos(angle);
            body.mesh.position.z = distance * Math.sin(angle);
        });

        // Animate moons around their planets
        moons.forEach((moon) => {
            const distance = moon.data.distance;
            const speed = 0.001 / distance; // Adjust speed based on distance
            const angle = (Date.now() * speed) % (2 * Math.PI);
            moon.mesh.position.x = moon.parent.position.x + distance * Math.cos(angle);
            moon.mesh.position.z = moon.parent.position.z + distance * Math.sin(angle);
        });
    });

    // Spaceship
    let spaceship;
    BABYLON.SceneLoader.ImportMesh("", "https://models.babylonjs.com/", "ufo.glb", scene, function (meshes) {
        spaceship = meshes[0];
        spaceship.scaling = new BABYLON.Vector3(1, 1, 1); // Slightly bigger
        spaceship.position = new BABYLON.Vector3(0, -15, 0);

        // Ship light
        const shipLight = new BABYLON.PointLight("shipLight", spaceship.position, scene);
        shipLight.intensity = 0; // Disable the ship light
        shipLight.parent = spaceship;

        // Make the ship emissive
        const shipMaterial = new BABYLON.StandardMaterial("shipMaterial", scene);
        shipMaterial.emissiveColor = new BABYLON.Color3(0, 0, 1);
        spaceship.material = shipMaterial;

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

        particleSystem.emitRate = 1500;

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

        canvas.addEventListener("click", function (evt) {
            pickResult = scene.pick(evt.clientX, evt.clientY);
            console.log("Pick result:", pickResult); // Debugging log
            if (pickResult.hit) {
                targetPosition = pickResult.pickedPoint;
                console.log("Target position set to:", targetPosition); // Debugging log
                spaceship.lookAt(targetPosition);
                particleSystem.start();
        
                // Reset the hasArrived flag
                hasArrived = false;
        
                // Zoom out without smooth transition
                camera.radius += 20;
        
                // Check if the target is a planet or moon
                if (pickResult.pickedMesh && (pickResult.pickedMesh.name.startsWith("planet") || pickResult.pickedMesh.name.startsWith("moon"))) {
                    startUpdatingTargetPosition(pickResult.pickedMesh);
                } else {
                    stopUpdatingTargetPosition();
                }
            } else {
                const pickInfo = scene.pick(evt.clientX, evt.clientY);
                console.log("Pick info:", pickInfo); // Debugging log
                if (pickInfo.hit) {
                    targetPosition = pickInfo.pickedPoint;
                    console.log("Target position set to:", targetPosition); // Debugging log
                    spaceship.lookAt(targetPosition);
                    particleSystem.start();
        
                    // Reset the hasArrived flag
                    hasArrived = false;
        
                    // Zoom out without smooth transition
                    camera.radius += 20;
        
                    // Check if the target is a planet or moon
                    if (pickInfo.pickedMesh && (pickInfo.pickedMesh.name.startsWith("planet") || pickInfo.pickedMesh.name.startsWith("moon"))) {
                        startUpdatingTargetPosition(pickInfo.pickedMesh);
                    } else {
                        stopUpdatingTargetPosition();
                    }
                }
            }
        });

        // Function to handle spaceship movement and camera focus
        scene.registerBeforeRender(function () {
            if (targetPosition) {
                const direction = targetPosition.subtract(spaceship.position).normalize();
                spaceship.position.addInPlace(direction.scale(0.1));
                if (BABYLON.Vector3.Distance(spaceship.position, targetPosition) < 0.1 && !hasArrived) {
                    stopUpdatingTargetPosition();
                    targetPosition = null;
                    particleSystem.stop();
                    hasArrived = true; // Set the flag to indicate arrival
                    if (pickResult && pickResult.pickedMesh && pickResult.pickedMesh.name.startsWith("planet")) {
                        setTimeout(() => {
                            camera.setTarget(pickResult.pickedMesh.position); // Set camera focus to the planet
                            console.log(`Arrived at planet: ${pickResult.pickedMesh.name}`); // debug
                            lightUpPlanet(pickResult.pickedMesh); // Light up the planet
                            showPopup(pickResult.pickedMesh);
                        }, 1000); // Add a delay before focusing on the planet
                    } else if (pickResult && pickResult.pickedMesh && pickResult.pickedMesh.name.startsWith("moon")) {
                        setTimeout(() => {
                            camera.setTarget(pickResult.pickedMesh.position); // Set camera focus to the moon
                            console.log(`Arrived at moon: ${pickResult.pickedMesh.name}`); // debug
                            lightUpPlanet(pickResult.pickedMesh); // Light up the moon
                            showPopup(pickResult.pickedMesh);
                        }, 1000); // Add a delay before focusing on the moon
                    } else if (pickResult && pickResult.pickedMesh && pickResult.pickedMesh.name === "sun") {
                        setTimeout(() => {
                            camera.setTarget(pickResult.pickedMesh.position); // Set camera focus to the sun
                            lightUpPlanet(pickResult.pickedMesh); // Light up the sun
                            showPopup(pickResult.pickedMesh);
                        }, 1000); // Add a delay before focusing on the sun
                    } else {
                        // Reset camera to sun if empty space is clicked
                        camera.setTarget(BABYLON.Vector3.Zero());
                        if (planetLight) {
                            console.log(`Resetting camera and disposing of light.`);// debug
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
        console.log(`lightUpPlanet called for: ${planet.name}`);
        if (currentLitPlanet) {
            console.log(`Current lit planet: ${currentLitPlanet.name}`);
        } else {
            console.log(`No planet is currently lit.`);
        }
    
        // If there is a currently lit planet, turn off its light
        if (currentLitPlanet && planetLight) {
            console.log(`Disposing light for: ${currentLitPlanet.name}`);
            planetLight.dispose();
            planetLight = null;
        }
    
        // Create a new hemispheric light for the visited planet
        planetLight = new BABYLON.HemisphericLight(`planetLight_${planet.name}`, new BABYLON.Vector3(0, 1, 0), scene);
        planetLight.intensity = 1.5;
        planetLight.parent = planet;
    
        console.log(`Created new light for: ${planet.name}`);
    
        // Ensure the light only affects the visited planet
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
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Moon2d.png"
            },
            "Phobos": {
                name: "Phobos",
                description: "Phobos is the innermost and larger of the two natural satellites of Mars. Phobos is a small, irregularly shaped object with a mean radius of 11 km.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Phobos2d.png"
            },
            "Deimos": {
                name: "Deimos",
                description: "Deimos is the smaller and outermost of the two natural satellites of the planet Mars, with a mean radius of 6.2 km.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Deimos2d.png"
            },
            "Io": {
                name: "Io",
                description: "Io is the innermost of the four Galilean moons of the planet Jupiter and, with a diameter of 3,643.2 km, the fourth-largest moon in the Solar System.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Io2d.png"
            },
            "Europa": {
                name: "Europa",
                description: "Europa is the smallest of the four Galilean moons orbiting Jupiter, and the sixth-closest to the planet.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Europa2d.png"
            },
            "Ganymede": {
                name: "Ganymede",
                description: "Ganymede is the largest and most massive moon of Jupiter and in the Solar System. It is the ninth largest object in the Solar System.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Ganymede2d.png"
            },
            "Callisto": {
                name: "Callisto",
                description: "Callisto is the second-largest moon of Jupiter, after Ganymede. It is the third-largest moon in the Solar System.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Callisto2d.png"
            },
            "Titan": {
                name: "Titan",
                description: "Titan is the largest moon of Saturn and the second-largest natural satellite in the Solar System. It is the only moon known to have a dense atmosphere.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Titan2d.png"
            },
            "Triton": {
                name: "Triton",
                description: "Triton is the largest natural satellite of the planet Neptune. It is the only large moon in the Solar System with a retrograde orbit.",
                image: "https://raw.githubusercontent.com/razvanpf/Images/main/2D%20Solar%20System%20Textures/Triton2d.png"
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
            "moon7_0": "Triton"
        };
    
        const planetName = meshNameToPlanetName[mesh.name];
        const planetInfo = planetDescriptions[planetName] || {};
    
        console.log("Mesh Name:", mesh.name);
        console.log("Planet Name:", planetName);
        console.log("Planet Info:", planetInfo);
    
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

    return scene;
};

const scene = createScene();

engine.runRenderLoop(function () {
    scene.render();
});

window.addEventListener("resize", function () {
    engine.resize();
});

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
