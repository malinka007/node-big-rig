/**
Copyright 2015 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be
found in the LICENSE file.
**/

require("./source_info.js");

'use strict';

global.tr.exportTo('tr.model.source_info', function() {
  function JSSourceInfo(file, line, column, isNative, scriptId, state) {
    tr.model.source_info.SourceInfo.call(this, file, line, column);

    this.isNative_ = isNative;
    this.scriptId_ = scriptId;
    this.state_ = state;
  }

  JSSourceInfo.prototype = {
    __proto__: tr.model.source_info.SourceInfo.prototype,

    get state() {
      return this.state_;
    },

    get isNative() {
      return this.isNative_;
    },

    get scriptId() {
      return this.scriptId_;
    },

    toString: function() {
      var str = this.isNative_ ? '[native v8] ' : '';
      return str +
          tr.model.source_info.SourceInfo.prototype.toString.call(this);
    }
  };

  return {
    JSSourceInfo: JSSourceInfo,
    JSSourceState: {
      COMPILED: 'compiled',
      OPTIMIZABLE: 'optimizable',
      OPTIMIZED: 'optimized',
      UNKNOWN: 'unknown'
    }
  };
});
