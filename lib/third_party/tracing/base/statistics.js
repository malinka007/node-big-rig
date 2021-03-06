/**
Copyright (c) 2014 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be
found in the LICENSE file.
**/

require("./range.js");

'use strict';

global.tr.exportTo('tr.b', function() {

  function identity(d) {
    return d;
  }

  function Statistics() {
  }

  /* Returns the quotient, or zero if the denominator is zero.*/
  Statistics.divideIfPossibleOrZero = function(numerator, denominator) {
    if (denominator === 0)
      return 0;
    return numerator / denominator;
  }

  Statistics.sum = function(ary, opt_func, opt_this) {
    var func = opt_func || identity;
    var ret = 0;
    for (var i = 0; i < ary.length; i++)
      ret += func.call(opt_this, ary[i], i);
    return ret;
  };

  Statistics.mean = function(ary, opt_func, opt_this) {
    return Statistics.sum(ary, opt_func, opt_this) / ary.length;
  };

  // Returns undefined if the sum of the weights is zero.
  Statistics.weightedMean = function(
      ary, weightCallback, opt_valueCallback, opt_this) {
    var valueCallback = opt_valueCallback || identity;
    var numerator = 0;
    var denominator = 0;

    for (var i = 0; i < ary.length; i++) {
      var weight = weightCallback.call(opt_this, ary[i], i);
      var value = valueCallback.call(opt_this, ary[i], i);
      numerator += weight * value;
      denominator += weight;
    }

    if (denominator === 0)
      return undefined;

    return numerator / denominator;
  };

  Statistics.variance = function(ary, opt_func, opt_this) {
    var func = opt_func || identity;
    var mean = Statistics.mean(ary, func, opt_this);
    var sumOfSquaredDistances = Statistics.sum(
        ary,
        function(d, i) {
          var v = func.call(this, d, i) - mean;
          return v * v;
        },
        opt_this);
    return sumOfSquaredDistances / (ary.length - 1);
  };

  Statistics.stddev = function(ary, opt_func, opt_this) {
    return Math.sqrt(
        Statistics.variance(ary, opt_func, opt_this));
  };

  Statistics.max = function(ary, opt_func, opt_this) {
    var func = opt_func || identity;
    var ret = -Infinity;
    for (var i = 0; i < ary.length; i++)
      ret = Math.max(ret, func.call(opt_this, ary[i], i));
    return ret;
  };

  Statistics.min = function(ary, opt_func, opt_this) {
    var func = opt_func || identity;
    var ret = Infinity;
    for (var i = 0; i < ary.length; i++)
      ret = Math.min(ret, func.call(opt_this, ary[i], i));
    return ret;
  };

  Statistics.range = function(ary, opt_func, opt_this) {
    var func = opt_func || identity;
    var ret = new tr.b.Range();
    for (var i = 0; i < ary.length; i++)
      ret.addValue(func.call(opt_this, ary[i], i));
    return ret;
  }

  Statistics.percentile = function(ary, percent, opt_func, opt_this) {
    if (!(percent >= 0 && percent <= 1))
      throw new Error('percent must be [0,1]');

    var func = opt_func || identity;
    var tmp = new Array(ary.length);
    for (var i = 0; i < ary.length; i++)
      tmp[i] = func.call(opt_this, ary[i], i);
    tmp.sort();
    var idx = Math.floor((ary.length - 1) * percent);
    return tmp[idx];
  };

  /* Clamp a value between some low and high value. */
  Statistics.clamp = function(value, opt_low, opt_high) {
    opt_low = opt_low || 0.0;
    opt_high = opt_high || 1.0;
    return Math.min(Math.max(value, opt_low), opt_high);
  }

  /**
   * Sorts the samples, and map them linearly to the range [0,1].
   *
   * They're mapped such that for the N samples, the first sample is 0.5/N and
   * the last sample is (N-0.5)/N.
   *
   * Background: The discrepancy of the sample set i/(N-1); i=0, ..., N-1 is
   * 2/N, twice the discrepancy of the sample set (i+1/2)/N; i=0, ..., N-1. In
   * our case we don't want to distinguish between these two cases, as our
   * original domain is not bounded (it is for Monte Carlo integration, where
   * discrepancy was first used).
   **/
  Statistics.normalizeSamples = function(samples) {
    if (samples.length === 0) {
      return {
        normalized_samples: samples,
        scale: 1.0
      };
    }
    // Create a copy to make sure that we don't mutate original |samples| input.
    samples = samples.slice().sort(
      function(a, b) {
        return a - b;
      }
    );
    var low = Math.min.apply(null, samples);
    var high = Math.max.apply(null, samples);
    var new_low = 0.5 / samples.length;
    var new_high = (samples.length - 0.5) / samples.length;
    if (high - low === 0.0) {
      // Samples is an array of 0.5 in this case.
      samples = Array.apply(null, new Array(samples.length)).map(
        function() { return 0.5;});
      return {
        normalized_samples: samples,
        scale: 1.0
      };
    }
    var scale = (new_high - new_low) / (high - low);
    for (var i = 0; i < samples.length; i++) {
      samples[i] = (samples[i] - low) * scale + new_low;
    }
    return {
      normalized_samples: samples,
      scale: scale
    };
  }

  /**
   * Computes the discrepancy of a set of 1D samples from the interval [0,1].
   *
   * The samples must be sorted. We define the discrepancy of an empty set
   * of samples to be zero.
   *
   * http://en.wikipedia.org/wiki/Low-discrepancy_sequence
   * http://mathworld.wolfram.com/Discrepancy.html
   */
  Statistics.discrepancy = function(samples, opt_location_count) {
    if (samples.length === 0)
      return 0.0;

    var max_local_discrepancy = 0;
    var inv_sample_count = 1.0 / samples.length;
    var locations = [];
    // For each location, stores the number of samples less than that location.
    var count_less = [];
    // For each location, stores the number of samples less than or equal to
    // that location.
    var count_less_equal = [];

    if (opt_location_count !== undefined) {
      // Generate list of equally spaced locations.
      var sample_index = 0;
      for (var i = 0; i < opt_location_count; i++) {
        var location = i / (opt_location_count - 1);
        locations.push(location);
        while (sample_index < samples.length &&
          samples[sample_index] < location) {
          sample_index += 1;
        }
        count_less.push(sample_index);
        while (sample_index < samples.length &&
            samples[sample_index] <= location) {
          sample_index += 1;
        }
        count_less_equal.push(sample_index);
      }
    } else {
      // Populate locations with sample positions. Append 0 and 1 if necessary.
      if (samples[0] > 0.0) {
        locations.push(0.0);
        count_less.push(0);
        count_less_equal.push(0);
      }
      for (var i = 0; i < samples.length; i++) {
        locations.push(samples[i]);
        count_less.push(i);
        count_less_equal.push(i + 1);
      }
      if (samples[-1] < 1.0) {
        locations.push(1.0);
        count_less.push(samples.length);
        count_less_equal.push(samples.length);
      }
    }
    // Iterate over the intervals defined by any pair of locations.
    for (var i = 0; i < locations.length; i++) {
      for (var j = i + 1; j < locations.length; j++) {
        // Length of interval
        var length = locations[j] - locations[i];

        // Local discrepancy for closed interval
        var count_closed = count_less_equal[j] - count_less[i];
        var local_discrepancy_closed = Math.abs(
          count_closed * inv_sample_count - length);
        var max_local_discrepancy = Math.max(
          local_discrepancy_closed, max_local_discrepancy);

        // Local discrepancy for open interval
        var count_open = count_less[j] - count_less_equal[i];
        var local_discrepancy_open = Math.abs(
          count_open * inv_sample_count - length);
        var max_local_discrepancy = Math.max(
          local_discrepancy_open, max_local_discrepancy);
      }
    }
    return max_local_discrepancy;
  };

  /**
   * A discrepancy based metric for measuring timestamp jank.
   *
   * timestampsDiscrepancy quantifies the largest area of jank observed in a
   * series of timestamps.  Note that this is different from metrics based on
   * the max_time_interval. For example, the time stamp series A = [0,1,2,3,5,6]
   *  and B = [0,1,2,3,5,7] have the same max_time_interval = 2, but
   * Discrepancy(B) > Discrepancy(A).
   *
   * Two variants of discrepancy can be computed:
   *
   * Relative discrepancy is following the original definition of
   * discrepancy. It characterized the largest area of jank, relative to the
   * duration of the entire time stamp series.  We normalize the raw results,
   * because the best case discrepancy for a set of N samples is 1/N (for
   * equally spaced samples), and we want our metric to report 0.0 in that
   * case.
   *
   * Absolute discrepancy also characterizes the largest area of jank, but its
   * value wouldn't change (except for imprecisions due to a low
   * |interval_multiplier|) if additional 'good' intervals were added to an
   * exisiting list of time stamps.  Its range is [0,inf] and the unit is
   * milliseconds.
   *
   * The time stamp series C = [0,2,3,4] and D = [0,2,3,4,5] have the same
   * absolute discrepancy, but D has lower relative discrepancy than C.
   *
   * |timestamps| may be a list of lists S = [S_1, S_2, ..., S_N], where each
   * S_i is a time stamp series. In that case, the discrepancy D(S) is:
   * D(S) = max(D(S_1), D(S_2), ..., D(S_N))
   **/
  Statistics.timestampsDiscrepancy = function(timestamps, opt_absolute,
                            opt_location_count) {
    if (timestamps.length === 0)
      return 0.0;

    if (opt_absolute === undefined)
      opt_absolute = true;

    if (Array.isArray(timestamps[0])) {
      var range_discrepancies = timestamps.map(function(r) {
        return Statistics.timestampsDiscrepancy(r);
      });
      return Math.max.apply(null, range_discrepancies);
    }

    var s = Statistics.normalizeSamples(timestamps);
    var samples = s.normalized_samples;
    var sample_scale = s.scale;
    var discrepancy = Statistics.discrepancy(samples, opt_location_count);
    var inv_sample_count = 1.0 / samples.length;
    if (opt_absolute === true) {
      // Compute absolute discrepancy
      discrepancy /= sample_scale;
    } else {
      // Compute relative discrepancy
      discrepancy = Statistics.clamp(
        (discrepancy - inv_sample_count) / (1.0 - inv_sample_count));
    }
    return discrepancy;
  };

  /**
   * A discrepancy based metric for measuring duration jank.
   *
   * DurationsDiscrepancy computes a jank metric which measures how irregular a
   * given sequence of intervals is. In order to minimize jank, each duration
   * should be equally long. This is similar to how timestamp jank works,
   * and we therefore reuse the timestamp discrepancy function above to compute
   * a similar duration discrepancy number.
   *
   * Because timestamp discrepancy is defined in terms of timestamps, we first
   * convert the list of durations to monotonically increasing timestamps.
   *
   * Args:
   *  durations: List of interval lengths in milliseconds.
   *  absolute: See TimestampsDiscrepancy.
   *  opt_location_count: See TimestampsDiscrepancy.
   **/
  Statistics.durationsDiscrepancy = function(
      durations, opt_absolute, opt_location_count) {
    if (durations.length === 0)
      return 0.0;

    var timestamps = durations.reduce(function(prev, curr, index, array) {
      prev.push(prev[prev.length - 1] + curr);
      return prev;
    }, [0]);
    return Statistics.timestampsDiscrepancy(
      timestamps, opt_absolute, opt_location_count);
  };


  /**
   * A mechanism to uniformly sample elements from an arbitrary long stream.
   *
   * Call this method every time a new element is obtained from the stream,
   * passing always the same |samples| array and the |numSamples| you desire.
   * Also pass in the current |streamLength|, which is the same as the index of
   * |newElement| within that stream.
   *
   * The |samples| array will possibly be updated, replacing one of its element
   * with |newElements|. The length of |samples| will not be more than
   * |numSamples|.
   *
   * This method guarantees that after |streamLength| elements have been
   * processed each one has equal probability of being in |samples|. The order
   * of samples is not preserved though.
   *
   * Args:
   *  samples: Array of elements that have already been selected. Start with [].
   *  streamLength: The current length of the stream, up to |newElement|.
   *  newElement: The element that was just extracted from the stream.
   *  numSamples: The total number of samples desired.
   **/
  Statistics.uniformlySampleStream = function(samples, streamLength, newElement,
                                              numSamples) {
    if (streamLength <= numSamples) {
      if (samples.length >= streamLength)
        samples[streamLength - 1] = newElement;
      else
        samples.push(newElement);
      return;
    }

    var probToKeep = numSamples / streamLength;
    if (Math.random() > probToKeep)
      return;  // New sample was rejected.

    // Keeping it, replace an alement randomly.
    var index = Math.floor(Math.random() * numSamples);
    samples[index] = newElement;
  };

  /**
   * A mechanism to merge two arrays of uniformly sampled elements in a way that
   * ensures elements in the final array are still sampled uniformly.
   *
   * This works similarly to sampleStreamUniform. The |samplesA| array will be
   * updated, some of its elements replaced by elements from |samplesB| in a
   * way that ensure that elements will be sampled uniformly.
   *
   * Args:
   *  samplesA: Array of uniformly sampled elements, will be updated.
   *  streamLengthA: The length of the stream from which |samplesA| was sampled.
   *  samplesB: Other array of uniformly sampled elements, will NOT be updated.
   *  streamLengthB: The length of the stream from which |samplesB| was sampled.
   *  numSamples: The total number of samples desired, both in |samplesA| and
   *      |samplesB|.
   **/
  Statistics.mergeSampledStreams = function(
      samplesA, streamLengthA,
      samplesB, streamLengthB, numSamples) {
    if (streamLengthB < numSamples) {
      // samplesB has not reached max capacity so every sample of stream B were
      // chosen with certainty. Add them one by one into samplesA.
      var nbElements = Math.min(streamLengthB, samplesB.length);
      for (var i = 0; i < nbElements; ++i) {
        Statistics.uniformlySampleStream(samplesA, streamLengthA + i + 1,
            samplesB[i], numSamples);
      }
      return;
    }
    if (streamLengthA < numSamples) {
      // samplesA has not reached max capacity so every sample of stream A were
      // chosen with certainty. Add them one by one into samplesB.
      var nbElements = Math.min(streamLengthA, samplesA.length);
      var tempSamples = samplesB.slice();
      for (var i = 0; i < nbElements; ++i) {
        Statistics.uniformlySampleStream(tempSamples, streamLengthB + i + 1,
            samplesA[i], numSamples);
      }
      // Copy that back into the first vector.
      for (var i = 0; i < tempSamples.length; ++i) {
        samplesA[i] = tempSamples[i];
      }
      return;
    }

    // Both sample arrays are at max capacity, use the power of maths!
    // Elements in samplesA have been selected with probability
    // numSamples / streamLengthA. Same for samplesB. For each index of the
    // array we keep samplesA[i] with probability
    //   P = streamLengthA / (streamLengthA + streamLengthB)
    // and replace it with samplesB[i] with probability 1-P.
    // The total probability of keeping it is therefore
    //   numSamples / streamLengthA *
    //                      streamLengthA / (streamLengthA + streamLengthB)
    //   = numSamples / (streamLengthA + streamLengthB)
    // A similar computation shows we have the same probability of keeping any
    // element in samplesB. Magic!
    var nbElements = Math.min(numSamples, samplesB.length);
    var probOfSwapping = streamLengthB / (streamLengthA + streamLengthB);
    for (var i = 0; i < nbElements; ++i) {
      if (Math.random() < probOfSwapping) {
        samplesA[i] = samplesB[i];
      }
    }
  }

  return {
    Statistics: Statistics
  };
});
