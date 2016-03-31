'use strict';

var extManager = require('../../extManager'),
    MarkerList = require('./markerList'),
    MarkerManager = require('./markerManager'),
    WysiwygMarkerHelper = require('./wysiwygMarkerHelper'),
    ViewOnlyMarkerHelper = require('./viewOnlyMarkerHelper'),
    MarkdownMarkerHelper = require('./markdownMarkerHelper');

var util = tui.util;

var MARKER_UPDATE_DELAY = 100,
    FIND_CRLF_RX = /(\n)|(\r\n)|(\r)/g;

extManager.defineExtension('mark', function(editor) {
    var ml = new MarkerList(),
        mm = new MarkerManager(ml),
        wmh, mmh, vmh;

    if (!editor.isViewOnly()) {
        wmh = new WysiwygMarkerHelper(editor.getSquire());
        mmh = new MarkdownMarkerHelper(editor.getCodeMirror());
    } else {
        vmh = new ViewOnlyMarkerHelper(editor.preview);
    }

    function getHelper() {
        var helper;

        if (editor.isViewOnly()) {
            helper = vmh;
        } else if (editor.isWysiwygMode()) {
            helper = wmh;
        } else {
            helper = mmh;
        }

        return helper;
    }

    editor.eventManager.addEventType('markerUpdated');

    $(window).resize(function() {
        var helper = getHelper();

        ml.getAll().forEach(function(marker) {
            helper.updateMarkerWithExtraInfo(marker);
        });

        editor.eventManager.emit('markerUpdated', ml.getAll());
    });

    editor.on('setValueAfter', function() {
        var helper = getHelper();
        mm.resetContent(helper.getTextContent());
    });

    editor.setValueWithMarkers = function(value, markerDataCollection) {
        var helper;

        ml.resetMarkers();

        markerDataCollection.forEach(function(markerData) {
            ml.addMarker(markerData.start, markerData.end, markerData.id);
        });

        editor.setValue(value);

        mm.resetContent(value.replace(FIND_CRLF_RX, ''));


        if (editor.isViewOnly() || editor.isWysiwygMode()) {
            helper = getHelper();
            mm.getUpdatedMarkersByContent(helper.getTextContent());
        } else {
            helper = mmh;
        }

        ml.getAll().forEach(function(marker) {
            helper.updateMarkerWithExtraInfo(marker);
        });

        return ml.getAll();
    };

    editor.getMarker = function(id) {
        return ml.getMarker(id);
    };

    editor.removeMarker = function(id) {
        return ml.removeMarker(id);
    };

    editor.exportMarkers = function() {
        var markersData;

        if (editor.isViewOnly() || editor.isMarkdownMode()) {
            markersData = ml.getMarkersData();
        } else if (editor.isWysiwygMode()) {
            mm.getUpdatedMarkersByContent(editor.getValue().replace(FIND_CRLF_RX, ''));
            markersData = ml.getMarkersData();
            mm.getUpdatedMarkersByContent(wmh.getTextContent());
        }

        return markersData;
    };

    editor.selectMarker = function(id) {
        var helper = getHelper(),
            marker = editor.getMarker(id);

        helper.selectOffsetRange(marker.start, marker.end);
    };

    editor.clearSelect = function() {
        getHelper().clearSelect();
    };

    if (!editor.isViewOnly()) {
        editor.on('changeMode', function() {
            var helper = getHelper();

            if (!ml.getAll().length) {
                return;
            }

            mm.getUpdatedMarkersByContent(helper.getTextContent());

            ml.getAll().forEach(function(marker) {
                helper.updateMarkerWithExtraInfo(marker);
            });

            editor.eventManager.emit('markerUpdated', ml.getAll());
        });

        editor.on('change', util.debounce(function() {
            var textContent,
                helper = getHelper();

            textContent = helper.getTextContent();

            mm.getUpdatedMarkersByContent(textContent);

            ml.getAll().forEach(function(marker) {
                helper.updateMarkerWithExtraInfo(marker);
            });

            editor.eventManager.emit('markerUpdated', ml.getAll());
        }, MARKER_UPDATE_DELAY));

        editor.addMarker = function(start, end, id) {
            var marker,
                helper = getHelper();

            if (!id) {
                id = start;
                marker = helper.getMarkerInfoOfCurrentSelection();
            } else {
                marker = {
                    start: start,
                    end: end
                };

                marker = helper.updateMarkerWithExtraInfo(marker);
            }

            if (marker) {
                marker.id = id;
                marker = ml.addMarker(marker);
                ml.sortWith('end');
                editor.eventManager.emit('markerUpdated', [marker]);
            }

            return marker;
        };
    }
});