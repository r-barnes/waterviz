L.TileLayer.Vector = L.TileLayer.extend({
    options: {
        tileRequestFactory: L.tileRequest,
        ajax: L.Request.get,
        // use L.tileCacheNone to turn caching off
        tileCacheFactory: L.tileCache,
        // factory function to create the vector tile layers (defaults to L.GeoJSON)
        layerFactory: L.geoJson,
        // factory function to create a web worker for parsing/preparing tile data
        //workerFactory: L.communistWorker
        workerFactory: L.noWorker
    },

    initialize: function (url, options, vectorOptions) {
        L.TileLayer.prototype.initialize.call(this, url, options);

        this.vectorOptions = vectorOptions || {};

        this._tileRequest = this.options.tileRequestFactory(this, this.options.ajax);
        this._tileCache = this.options.tileCacheFactory();
        // reference to a standalone function that can be stringified for a web worker
        this._parseData = this.options.parseData || L.TileLayer.Vector.parseData;
        this._worker = this.options.workerFactory(this._parseData);
        this._addQueue = new L.TileQueue(L.bind(this._addTileDataInternal, this));
        
    },

    onAdd: function (map) {
        L.TileLayer.prototype.onAdd.call(this, map);

        this.on('tileunload', this._unloadTile);

        // root vector layer, contains tile vector layers as children 
        this.vectorLayer = this._createVectorLayer(); 
        map.addLayer(this.vectorLayer);

        this._worker.onAdd(map);
        this._tileCache.onAdd(map);
    },

    onRemove: function (map) {
        // unload tiles (L.TileLayer only calls _reset in onAdd)
        this._reset();
        map.removeLayer(this.vectorLayer);

        L.TileLayer.prototype.onRemove.call(this, map);

        this.off('tileunload', this._unloadTile);

        this._worker.onRemove(map);
        this._tileCache.onRemove(map);

        this.vectorLayer = null;
    },

    _addTile: function(coords, container) {
        var cached = null;
        this._wrapCoords(coords);
        var key = this._tileCoordsToKey(coords);
        var urlZoom = this._getZoomForUrl();
        var tile = cached = this._tileCache.get(key, urlZoom);
        if (!tile) {
            tile = { key: key, urlZoom: urlZoom, datum: null, loading: true };
        } else {
            tile.loading = true;
        }

        this._tiles[key] = tile;
        this.fire('tileloadstart', {tile: tile});

        if (cached) {
            this._addTileData(tile);
        } else {
            tile.url = this.getTileUrl(coords);
            this._loadTile(tile);
        }
    },

    _loadTile: function (tile) {
        this._tileRequest.process(tile, L.bind(function(err, tile) {
            if (!err) {
                this._addTileData(tile);
            } else {
                this._tileLoaded();
            }
        },this));
    },

    // TODO _tileLoaded replaced by _tileReady + _visibleTilesReady, 
    // but cannot use because tile assumed to be component (L.DomUtil.addClass)?
    _tileLoaded: function () {
        this._tilesToLoad--;

        if (this._tilesToLoad === 0) {
            this.fire('load');
        }
    },

    _createVectorLayer: function() {
        return this.options.layerFactory(null, this.vectorOptions);
    },

    _createTileLayer: function() {
        return this._createVectorLayer();
    },

    _addTileData: function(tile) {
        if (!tile.parsed) {
            this._worker.process(tile, L.bind(function(err, tile) {
                if (!err) {
                    this._addQueue.add(tile);
                } else {
                    // TODO refactor, copied from TileRequest, needed when plain request in worker
                    tile.loading = false;
                    this.fire('tileerror', {tile: tile});
                    this._tileLoaded();
                }
            },this));
        } else {
            // from cache
            this._addQueue.add(tile);
        }
    },

    _addTileDataInternal: function(tile) {
        var tileLayer = this._createTileLayer();
        if (!tile.parsed) {
            // when no worker for parsing
            tile.parsed = this._parseData(tile.datum);
            tile.datum = null;
        }
        tileLayer.addData(tile.parsed);
        tile.layer = tileLayer;
        this.vectorLayer.addLayer(tileLayer);

        tile.loading = false;
        this.fire('tileload', {tile: tile});
        this._tileLoaded();
    },

    _unloadTile: function(evt) {
        var tile = evt.tile,
            tileLayer = tile.layer;

        this._tileRequest.abort(tile);

        if (tile.loading) {
            this._addQueue.remove(tile);
            // not from cache or not loaded and parsed yet
            if (!tile.parsed) {
                this._worker.abort(tile);
            }
            this.fire('tileabort', {tile: tile});
            this._tileLoaded();
        }
        if (tileLayer && this.vectorLayer.hasLayer(tileLayer)) {
            this.vectorLayer.removeLayer(tileLayer);
        }

        if (tile.parsed) {
            this._tileCache.put(tile);
        }
    },

    _reset: function() {
        L.TileLayer.prototype._reset.apply(this, arguments);
        this._addQueue.clear();
        this._worker.clear();
    }
});

L.extend(L.TileLayer.Vector, {
    parseData: function(data) {
        return JSON.parse(data);
    }
});