notes for don't turn around

- need player footsteps
- need to improve player breathing

can we create a measuring tape and coordinate system? I have an idea where I can stand a place a marker and then walk a certain distance, and in the dev hud the line I just drew can be copied and then given to you (or a function) to map out areas on the map? is that a heavy lift?

I want to make the phone toggleable and connected to an inventory system. when activated, we should see the hand holding the phone up as a flashlight. the inventory should show 2 hands shuffling through the various items in the inventory.

first thing i want to do is make the first mini-quest to find your phone. let's have it flickering on the ground next to the player when they first start.

new stuff

fix the walking/running audio. make it sound squishier. current sound is great for pavement. reduce the number of twig break sounds for both player and pursuer and differentiate the sound of the player's footsteps from the pursuer's. they need to be distinct.

add proximity rustling for when player runs past trees so we can hear distinctive rustling for each

the pursuer should slow down when getting closer to player. right now, the player can't (I) can't get oriented well enough to shine the light on the pursuer. I'd also like to give the pursuer a more humanoid form.

for the pursuer/flashlight system - we want the pursuer to pause when the light is close to them or hitting them. we need to give the player a bit more time to react, maybe just .5 - 1s. also let's have pursuer spawn in the middle of the forest each time and player spawn in the middle of the bottom of the terrain.

instead of a bell, let's have the sound be the car (in the parking lot and our goal) alarm going off.

fix the look of the mountains. they still look kinda funny. I actually think billboards for the backdrop with a boundary that player cannot cross would be great for this

fix the mountains. they seem to move in space with player but should be fixed - they are mountainxs.

add a really rocky mountain trail to our game plan

remove the # runs item from dev hud and other associated logic. we will be adding more trails later instead, so that will take the palce of this simple levelling system.

remove spawn eyes from dev hud

add growling sounds for the pursuer for when they are within a certain proximity

decrease the playewrs disorientation effect somewhat

let's put a cap on how long the player can run at full speed before they need to stop and catch their breath

let's give the car a more sleek design. it's still look really boxy

add wildlife: deer, birds, occasional fox or turkey

increase render distance for ps3 mode

have the pursuer pursue faster once you have found the item

remove f5 (which is page reload) as the restart key

generate a landscape with a river and arock path that can be used to get across it.

for first level, when car is in view, unlock the player ability to press the button on the key fob to torun off the alarm

in later levels this can be a game mechanic that has to be used to look for the car, where you press the button to hear a car alarm chirp, which can be used to navigate. otherwise the constant alarming will become very annonying.

make the pursuer vanish and appear using a fade effect instead of a strict on/off.

the missing artifact overlay lasts far too long. don't pause tyhe graphics, just show the toast message.

it's not clear when the player is captured by the pursuer what is happening. I am not hearing the pursuer growl.
