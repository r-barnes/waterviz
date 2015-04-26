
// Construct map, center if no location provided
var map = L.map('map', {
  maxZoom:   13
  //minZoom:   1,
  /*maxBounds: [
    [20, -125], //Southwest
    [50,  -66]  //Northeast
  ]*/
});
var hash = new L.Hash(map);
if (!window.location.hash) {
    map.setView([37.958, -120.976], 8);
}

// Make the base map; a raster tile relief map from ESRI
var esriRelief = 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}';

var basemap = L.tileLayer(esriRelief, {
  attribution: '<a href="http://www.arcgis.com/home/item.html?id=9c5370d0b54f4de1b48a3792d7377ff2">ESRI shaded relief</a>, <a href="http://www.horizon-systems.com/NHDPlus/NHDPlusV2_home.php">NHDPlus v2</a>',
  maxZoom: 13
});
//basemap.addTo(map);

// Add a single GeoJSON vector file for state boundaries
// This was loaded statically as a script; could also be AJAX
var stateLayer = new L.geoJson(usStates);
stateLayer.setStyle({ "color": "#444",
                      "weight": 1,
                      "fill": false,
                      "opacity": 1.0 });
stateLayer.addTo(map);

var nlcdlayer = L.tileLayer('/nlcd/{z}/{x}/{y}.png',{tms:true}).addTo(map);


var requestsPool = {
  requests: {}, //list of urls
  timeouts: {},
  timeout:  1000*60*10, //In milliseconds
  fetch: function(url) {
    if(requestsPool.exists(url))
      return requestsPool.requests[url];

    requestsPool.timeouts[url] = setTimeout(function(u) {
        requestsPool.remove(u);
    }.bind(this, url), requestsPool.timeout); //Defining the timeout

    requestsPool.requests[url] = $.getJSON(url);
    return requestsPool.requests[url];
  },
  exists: function(url) {
    return requestsPool.requests.hasOwnProperty(url); //Return the Timeout ID if present or undefined
  },
  remove: function(url) {
    requestsPool.cancel(url);
    delete requestsPool.requests[url];
  },
  cancel: function(url) {
    clearTimeout(requestsPool.timeouts[url]); //cancel the timeout
    delete requestsPool.timeouts[url];
  }
}





function UpdateRivers(newtime){
  requestsPool.fetch('/gauges/reachflow/'+newtime)
  .done(function(val){
    _.each(val['reachflows'],function(o){
      $('.h'+o.huc8).css('stroke',       (o.drank!==null)?grad_colours[Math.floor((grad_colours.length-1)*o.drank/100.0)]:'#FF00DE' );
      $('.h'+o.huc8).css('stroke-width', ((o.drank!==null)?(6*o.drank/100.0+2).toString():'2')+'px' );
    });
  });
}

// Style the river lines; width depends on its Strahler number
function riverStyle(feature) {
  var fp   = feature.properties;
  var temp = "stroke:" + ((fp.drank!==null)?grad_colours[Math.floor((grad_colours.length-1)*fp.drank/100.0)]:'#FF00DE') + ';' + "stroke-width:" + ((fp.drank!==null)?(6*fp.drank/100.0+2).toString():fp.strahler * map.getZoom()/13)+'px' + ';';
  return temp;
}

function riverClass(feature){
  return "river h" + feature.properties.huc8;
}

// Make the river overlay layer, vector tiles from our TileStache/Gunicorn server
var geojsonURL = "/rivers/{z}/{x}/{y}.json";
var riverLayer = new L.TileLayer.d3_geoJSON(geojsonURL, {
  class:         riverClass,
  style:         riverStyle,
});
map.addLayer(riverLayer);

var countystyle = {
  "color":       "black",
  "stroke":      "black",
  "weight":      3,
};

function highlightCounty(e) {
  var layer = e.target;

  layer.setStyle({
    weight:      5,
    color:       '#666',
  });

  if (!L.Browser.ie && !L.Browser.opera) {
      layer.bringToFront();
  }
}

function resetCounty(e) {
  var layer = e.target;

  layer.setStyle({
    weight: 3,
    color:  "black"
  });
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

function onEachCounty(feature, layer) {
  layer.on({
      mouseover: highlightCounty,
      mouseout:  resetCounty,
      click:     zoomToFeature
  });
}

var counties = new L.geoJson(null,{style:countystyle,onEachFeature:onEachCounty});
$.getJSON("/counties.json",
  function(data) {
    $(data.features).each(function(key, data) {
      counties.addData(data);
    });
  }
);

setTimeout(function(){colourCounties('allwater',95);},1000*5);

map.on('dragend', function(e) {
  //$('#spinnerBox').fadeIn();
  getStations();
});

map.on('zoomend', function() {
  getStations();
});

var markers = new L.FeatureGroup();
map.addLayer(markers);

var grad_colours = ['#b2182b','#d6604d','#f4a582','#fddbc7','#f7f7f7','#d1e5f0','#92c5de','#4393c3','#2166ac']

var hurricane_tracks = L.featureGroup();
map.addLayer(hurricane_tracks);
var hurricane_points = L.featureGroup();
map.addLayer(hurricane_points);

var baseLayers = {
  "Terrain": basemap,
  "NLCD":    nlcdlayer,
};

var overlays = {
  "Rivers":           riverLayer,
  "Gauge Stations":   markers,
  "Counties":         counties,
  "Hurricane Tracks": hurricane_tracks,
  "Hurricane Points": hurricane_points
};

L.control.layers(baseLayers, overlays).addTo(map);


function getStations() {
  // Clear markers before getting new ones
  markers.clearLayers();

  // Get map bounds from Leaflet.  getBounds() returns an object
  var bbox = map.getBounds();

  var addy = "/gauges/list/xmin/ymin/xmax/ymax";
  addy     = addy.replace("xmin",bbox._southWest.lng);
  addy     = addy.replace("ymin",bbox._southWest.lat);
  addy     = addy.replace("xmax",bbox._northEast.lng);
  addy     = addy.replace("ymax",bbox._northEast.lat);

  //use jQuery's getJSON() to call the SODA API for NYC 311
  $.getJSON(addy, function(data) {
    //iterate over each 311 complaint, add a marker to the map
    _.each(data, function(marker){
      var markerItem = L.circleMarker(
        [marker.lat,marker.lng],
        {
          radius:      5,
          color:       'black',
          fillColor:   (marker.drank!==null)?grad_colours[Math.floor((grad_colours.length-1)*marker.drank)]:'#FF00DE',
          fillOpacity: 1
        }
      );
      markerItem.on('mouseover', function(){
        $('#headerbar').html(marker.name);
        $('#bottomright').html(
          'Stage: ' + marker.svalue + ' ft<br>' +
          '<span class="ddate">'+marker.sdt+'</span><br>' +
          'Discharge: ' + marker.dvalue + ' cfs<br>' +
          '<span class="ddate">'+marker.ddt+'</span><br>' +
          'Rank: ' + marker.drank.toFixed(2) + '<br>' +
          'More info <a href="'+marker.featuredet+'">here</a>'
          );
      });

      // markerItem.bindPopup(
      //   '<h4>' + marker.complaint_type + '</h4>'
      //   + (new Date(marker.created_date)).toDateString()
      //   + ((marker.incident_address != null) ? '<br/>' + marker.incident_address : '')
      // );

      markers.addLayer(markerItem);
    });
  });
}

function colourCounties(style,percentile_max){
  $.getJSON('/county/style/'+style+'?percentile_max='+percentile_max,function(data){
    counties.setStyle(function(feature){
      var myid = feature.properties.STATE+feature.properties.COUNTY;
      return data[myid];
    });
  });
}
colourCounties('allwater',95);


$('.nlcdgrad').hover(function(e){
  var classname = $(e.target).data('classname');
  $('#nlcdexplanation').html(classname);
}, function(){
  $('#nlcdexplanation').html('NLCD Legend (hover over colours for details)');
});




function UpdateHurricanes(newtime){
  var newtimeunix = moment(newtime,'YYYY-MM-DD').unix();
  requestsPool.fetch('/hurricanes/'+newtime) //Prevent multiple calls to server in same session
  .done(function(data){
    var load_time = moment().unix();
    _.each(data['hurricanes'],function(o){
      if(!_.has(hurricanes,o.stormid)){
        hurricanes[o.stormid] = {
          mintime:   moment('2100-01-01','YYYY-MM-DD').unix(),
          maxtime:   moment('1800-01-01','YYYY-MM-DD').unix(),
          points:    [],
          load_time: load_time
        };
      } else if(hurricanes[o.stormid].load_time!=load_time)
        return;
      var ptgeojson = {type:"Feature",properties:o,geometry:{type:"Point",coordinates:[o.lon,o.lat]}};
      o.marker      = L.geoJson(ptgeojson,{pointToLayer: function (feature, latlng) {
        return new L.CircleMarker(latlng, {radius: o.wind/5, fillOpacity: 0.55, fillColor:'red', color:'red'});
      }});
      o.marker.stormid = o.stormid;
      o.marker.dt      = moment(o.dt,'YYYY-MM-DD').unix();
      o.marker.on('mouseover',function(e){
        e.layer.setStyle({color:'black'});
        $('#headerbar').html("Hurricane " + o.name);
        $('#bottomright').html("Wind: "+(o.wind*1.15077945).toFixed(0)+" MPH<br>" + o.dt);
      });
      o.marker.on('mouseout',function(e){
        e.layer.setStyle({color:'red'});
      });
      hurricane_points_raw.push(o.marker);
      hurricane_points.addLayer(o.marker);
      hurricanes[o.stormid].points.push(o);
      hurricanes[o.stormid].name    = o.name;
      hurricanes[o.stormid].mintime = Math.min(hurricanes[o.stormid].mintime, moment(o.dt,'YYYY-MM-DD').unix());
      hurricanes[o.stormid].maxtime = Math.max(hurricanes[o.stormid].maxtime, moment(o.dt,'YYYY-MM-DD').unix());
    });
    _.each(hurricanes,function(o){
      if(_.has(o,'line'))
        return;
      var polyline      = {type:"Feature",geometry:{type:"LineString", coordinates:_.map(o.points,function(x){return [x.lon,x.lat];})}};
      polyline          = turf.bezier(polyline);
      o.line            = L.geoJson(polyline, {color:'green',weight:5});
      o.name            = o.name.toLowerCase().replace( /\b\w/g, function (m) {return m.toUpperCase();}); //Capitalize first letter of each word
      o.line.properties = {mintime:o.mintime,maxtime:o.maxtime};
      o.line.on('mouseover',function(e){
        e.layer.setStyle({color:'#A6FF00'});
        $('#headerbar').html("Hurricane " + o.name)
      });
      o.line.on('mouseout',function(e){
        e.layer.setStyle({color:'green'});
      });
      hurricane_tracks_raw.push(o.line);
      hurricane_tracks.addLayer(o.line,true);
    });
    _.each(hurricane_tracks_raw, function(o){
      if(!(o.properties.mintime<=newtimeunix && newtimeunix<=o.properties.maxtime))
        hurricane_tracks.removeLayer(o);
      else
        hurricane_tracks.addLayer(o);
    });
    _.each(hurricane_points_raw, function(o){
      if(!(hurricanes[o.stormid].mintime<=newtimeunix && newtimeunix<=hurricanes[o.stormid].maxtime))
        hurricane_points.removeLayer(o);
      else {
        hurricane_points.addLayer(o);
        if(o.dt==newtimeunix)
          o.setStyle({fillColor:'green'});
        else
          o.setStyle({fillColor:'red'});
      }
    });
  });
}



var hurricanes           = {};
var hurricane_points_raw = [];
var hurricane_tracks_raw = [];
//TODO: Prevent multiple calls to hurricanes for the same date
function timeChanged(newtime){
  UpdateHurricanes(newtime);
  UpdateRivers(newtime);
}

$(document).ready(function(){
  $('#datepicker').datepick({
    minDate:    '1950-01-01',
    maxDate:    'now',
    dateFormat: 'yyyy-mm-dd',
    onSelect:   function(date) { timeChanged(moment(date[0]).format('YYYY-MM-DD')); }
  });

  $('#datepicker').val(moment().format('YYYY-MM-DD'));

  $('#dateminus').click(function(){
    var dedate = moment($('#datepicker').val(), "YYYY-MM-DD");
    dedate.add(-1, 'days');
    if(dedate.unix()>=moment('1950-01-01').unix())
      $('#datepicker').val( dedate.format('YYYY-MM-DD') );
    timeChanged(dedate.format('YYYY-MM-DD'));
  });

  $('#dateplus').click(function(){
    var dedate = moment($('#datepicker').val(), "YYYY-MM-DD");
    dedate.add(1, 'days');
    if(dedate.unix()<moment().unix())
      $('#datepicker').val( dedate.format('YYYY-MM-DD') );
    timeChanged(dedate.format('YYYY-MM-DD'));
  });

  getStations();

});