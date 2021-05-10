if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
} // if

let map;
let service;
let infoWindowLoc; // popup for restaurant info
let pos; // user's location 
let directionsDisplay; // to render directions. Must be global to clear route when a new route needs to be displayed
let markers = []; // list of all markers on the map

// initialize map
function initMap() {
   directionsDisplay = new google.maps.DirectionsRenderer({map: map}); // to render route
  
   // used if there's a geolocation error
   let infoWindowCurrentLocation = new google.maps.InfoWindow();
  
  // https://developers.google.com/maps/documentation/javascript/infowindows
  infoWindowLoc = new google.maps.InfoWindow();
  
  // use a promise to wait for the location-finding and error checking to be completed
  let findLocation = async function() {
   let promise = new Promise(function(resolve, reject)  {
      
      // check to see if browswer supports geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }
            
            // once position is found through geolocation, promise is successful
            resolve();
          }, () => {

          // if geolocation doesn't work, set default location
          handleLocationError(true, infoWindowCurrentLocation);
            
         // once fallback position is set, promise is successful
         resolve();
        });
      } else {
        // Browser doesn't support Geolocation, so set default position
        handleLocationError(false, infoWindowCurrentLocation);
        
        // once fallback position is set, promise is successful
        resolve();
      } // else
     
   });
    
    // end function when promise has been resolved
    let result = await promise;
  }
  
  // run map set up only after location-finding and error-checking is complete
  findLocation().then(
    function() {
      
      // center map on user's location
      map = new google.maps.Map(document.getElementById('map'), {
        center: pos,
        zoom: 13
      });

      // create marker for user's location
      let user = new google.maps.Marker({
        position: pos,
        map,
        title: "Current Location",
        draggable: true
      });

      // update user location when marker is dragged
      google.maps.event.addListener (user, 'dragend', function() {
        pos = {          
          lat: user.getPosition().lat(),
          lng: user.getPosition().lng(),
        };

        // clear search result markers
        clearMarkers();

        searchLocations(pos);
      });

      // add listener to complete a search with the user's query
      document.getElementById('searchBtn').addEventListener('click', function() {
        searchLocations(pos);
      });

     // stop user from typing in a value outside of the max or min for number of results
     let numInput =  document.getElementById("quantity");
     numInput.addEventListener('keyup', function () {
       let value = numInput.value;
       if (value > 20) {
         numInput.value = 20;
       } else if (value < 1) {
         numInput.value = 1;
       } // if
     });
      
      // default search
      searchLocations(pos);
  });
} // initMap

// give error and defualt marker position if message if geolocation fails
function handleLocationError(browserHasGeolocation, infoWindow) {
  pos = {
    lat: 48.4475,
    lng: -123.4956
  };
  
  // set error message
  let alert = document.getElementById("alert");
  alert.innerHTML += 
    browserHasGeolocation  
    ? "If you want to automatically find your location, allow location access through your browser and reload the page. Otherwise, dismiss this and manually drag the red marker to your desired location." 
    : "Your browser doesn't support geolocation, so your current location cannot be found. Instead, manually drag the marker to your desired location.";
    
    alert.style.display = "block";
} // handleLocationError


// find 3 most highly rated locations within 3km of user's location
function searchLocations(location) {
  
  let query = document.getElementById("search").value; // user's chosen search terms
  
  // if search terms are empty, don't search
  if (query == "") {
    return;
  } // if
  
  let radius = document.getElementById("slider").value; // user's chosen search radius
  
  // remove anything from the results of the last search
  clearMarkers();
  clearDirections();
  
  // NOTE: API still returns results outside of specified search radius
  // https://developers.google.com/maps/documentation/places/web-service/search#TextSearchRequests
  let request = {
    location: location,
    radius: radius,
    query: query,
  };

  service = new google.maps.places.PlacesService(map);
  service.textSearch(request, processSearch);
} // searchLocations

// process search response
function processSearch(results, status) {
  if (status == google.maps.places.PlacesServiceStatus.OK) {
    
    // sort locations by rating from highest to lowest  
    results.sort(function(a, b) {
      return b.rating - a.rating;
    });

    // convert user's current location into object that maps API can use
    let currentPosition = new google.maps.LatLng(pos);

    // number of results to be shown (between 1 and 20 ) chosen by user 
    let numResults = document.getElementById("quantity").value;

    // put markers on highest rated locations that are ALSO WITHIN SEARCH RADIUS
    for (let i = 0; i < results.length; i++) {
      
      // loop through results until the right number of locations are displayed
      if (markers.length != numResults) {  
        
        // distance in meters between user location and restaurant
        let distance = google.maps.geometry.spherical.computeDistanceBetween(currentPosition, results[i].geometry.location); 

        // NOTE: actual directions may show distance as more than the search radius, since routes don't t go perfectly straight from user to destination.
        //       The way around this is to use directions service to get all of the routes and find route distances within the search radius,
        //       but that seems like an unecessary use of resources 

        // create marker for restaurant if it's within user's search radius
        if (distance < 3000) {
              createMarker(results[i]);
          } // if
      } else {
          i = results.length; // end the loop
      } // else
    } // for
  } // if
} // processSearch

// create a marker and its info at specified place
// https://developers.google.com/maps/documentation/javascript/examples/place-search#maps_place_search-javascript
function createMarker(place) {
  
  if (!place.geometry || !place.geometry.location) return;
  
  // create the actual marker
  // https://developers.google.com/maps/documentation/javascript/markers
  let pin =  { path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
        fillColor: "#FFFF00",
        fillOpacity: 1,
        strokeColor: '#000',
        strokeWeight: 2,
        scale: 1};
  
  const marker = new google.maps.Marker({
    map,
    position: place.geometry.location,
    icon: pin,
    title: place.name
  });
  
  google.maps.event.addListener(marker, "click", () => {
    
    // put relevant information (location name, address, directions button, travel mode dropdown) into an infowindow
    let contentString = '<h3>' + place.name + '</h3>' + 
                        '<p class="address">' + place.formatted_address + '</p>' +
                        'Rating: <b>' + place.rating + ' / 5 </b><br><br>' +
                        '<div class="row"><button class="btn btn-info col" id="' + place.place_id + '">Directions</button>' +
                        '<br><div class="col" id="travelMode"></b><select class="form-select" id="mode">' +
                        '<option value="DRIVING">Driving</option>' +
                        '<option value="WALKING">Walking</option>' +
                        '<option value="BICYCLING">Bicycling</option>' +
                        '<option value="TRANSIT">Transit</option>' +
                        '</select></div></div>'

    infoWindowLoc.setContent(contentString || "");
    infoWindowLoc.open(map, marker);
    
    // clear old listener from infowindow, otherwise it will look for the directions button before infowindow is in the DOM
    google.maps.event.clearListeners(infoWindowLoc, 'domready');
    
    // once infowindow is in the DOM, add getDirections event to button inside it
    google.maps.event.addListener(infoWindowLoc, 'domready', function() {
      document.getElementById(place.place_id).addEventListener("click", function() {
        getDirections(place.geometry);
      });
   });

  });
  
  // add to global count of markers
  markers.push(marker);
} // createMarker

// visually and programmatically delete all markers
function clearMarkers() {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  } // for
  markers = [];
} // clearMarkers

// give user directions to restaurant
function getDirections(location) {
  let travelMode = document.getElementById("mode").value;

  let request =  {
  origin: pos,
  destination: location.location,
  travelMode: google.maps.TravelMode[travelMode],
  unitSystem: google.maps.UnitSystem.METRIC
}
 
  // send request to directions service 
  let directionsService = new google.maps.DirectionsService();
  directionsService.route(request, processDirections);
} // getDirections


// process and display directions from request
// https://developers.google.com/maps/documentation/javascript/directions
function processDirections(response, status) {
  if (status == google.maps.DirectionsStatus.OK) {

    // https://developers.google.com/maps/documentation/javascript/directions
    // render visual route on the map
    directionsDisplay.setOptions({
      polylineOptions: {
        strokeColor: '#ff0000',
        strokeWeight: 8,
      }
    });
    
    directionsDisplay.setMap(map);
    directionsDisplay.setDirections(response);
    
    // https://developers.google.com/maps/documentation/javascript/examples/directions-panel?csw=1#maps_directions_panel-javascript
    let steps = document.getElementById("floating-panel");

    // display step by step directions
    directionsDisplay.setPanel(steps);
    document.getElementById("route").style.display = "block";
    } else {
      window.alert('Sorry, your request for directions failed. Try again later!');
    } // else
  
  infoWindowLoc.close();
} // processDirections

// visually remove directions and route from map
function clearDirections() {
  directionsDisplay.setMap(null);
  directionsDisplay.setPanel(null);
  
  document.getElementById("route").style.display = "none";
} // clearDirections
