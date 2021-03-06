/**
Copyright (c) 2013 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be
found in the LICENSE file.
**/

require("../base/iteration_helpers.js");
require("../base/sorted_array_utils.js");
require("../base/units/time_stamp.js");
require("./event.js");

'use strict';

global.tr.exportTo('tr.model', function() {

  /**
   * The value of a given measurement at a given time.
   *
   * As an example, if we're measuring the throughput of data sent over a USB
   * connection, each counter sample might represent the instantaneous
   * throughput of the connection at a given time.
   *
   * @constructor
   * @extends {Event}
   */
  function CounterSample(series, timestamp, value) {
    tr.model.Event.call(this);
    this.series_ = series;
    this.timestamp_ = timestamp;
    this.value_ = value;
  }

  CounterSample.groupByTimestamp = function(samples) {
    var samplesByTimestamp = tr.b.group(samples, function(sample) {
      return sample.timestamp;
    });

    var timestamps = tr.b.dictionaryKeys(samplesByTimestamp);
    timestamps.sort();
    var groups = [];
    for (var i = 0; i < timestamps.length; i++) {
      var ts = timestamps[i];
      var group = samplesByTimestamp[ts];
      group.sort(function(x, y) {
        return x.series.seriesIndex - y.series.seriesIndex;
      });
      groups.push(group);
    }
    return groups;
  }

  CounterSample.prototype = {
    __proto__: tr.model.Event.prototype,

    get series() {
      return this.series_;
    },

    get timestamp() {
      return this.timestamp_;
    },

    get value() {
      return this.value_;
    },

    set timestamp(timestamp) {
      this.timestamp_ = timestamp;
    },

    addBoundsToRange: function(range) {
      range.addValue(this.timestamp);
    },

    getSampleIndex: function() {
      return tr.b.findLowIndexInSortedArray(
          this.series.timestamps,
          function(x) { return x; },
          this.timestamp_);
    },

    get userFriendlyName() {
      return 'Counter sample from ' + this.series_.title + ' at ' +
          tr.b.u.TimeStamp.format(this.timestamp);
    }
  };


  tr.model.EventRegistry.register(
      CounterSample,
      {
        name: 'counterSample',
        pluralName: 'counterSamples',
        singleViewElementName: 'tr-ui-a-counter-sample-sub-view',
        multiViewElementName: 'tr-ui-a-counter-sample-sub-view'
      });

  return {
    CounterSample: CounterSample
  };
});
