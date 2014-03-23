var H5P = H5P || {};

/**
 * DragQuestion module.
 *
 * @param {jQuery} $
 */
H5P.DragQuestion = (function ($) {

  /**
   * Initialize module.
   *
   * @param {Object} options Run parameters
   * @param {Number} id Content identification
   */
  function C(options, id) {
    this.$ = $(this);
    this.id = id;
    this.options = $.extend(true, {}, {
      scoreShow: 'Show score',
      correct: 'Solution',
      tryAgain: 'Try again',
      question: {
        settings: {
          size: {
            width: 620,
            height: 310
          }
        },
        task: {
          elements: [],
          dropZones: []
        }
      },
      enableTryAgain: true,
      preventResize: false,
      displaySolutionsButton: true,
      postUserStatistics: (H5P.postUserStatistics === true),
      singlePoint: true
    }, options);

    this.userAnswers = [];
    this.elementZones = [];
    this.$elements = [];
    this.displayingSolution = false;
    
    // Create map over correct drop zones for elements
    var task = this.options.question.task;
    this.correctDZs = [];
    for (var i = 0; i < task.dropZones.length; i++) {
      var correctElements = task.dropZones[i].correctElements;
      for (var j = 0; j < correctElements.length; j++) {
        var correctElement = correctElements[j];
        if (this.correctDZs[correctElement] === undefined) {
          this.correctDZs[correctElement] = [];
        }
        this.correctDZs[correctElement].push(i);
      }
    }
  };

  /**
   * Append field to wrapper.
   *
   * @param {jQuery} $container
   */
  C.prototype.attach = function ($container) {
    var that = this;

    // If reattaching, we no longer show solution. So forget that we
    // might have done so before.
    this.displayingSolution = false;

    this.$container = $container.addClass('h5p-dragquestion').html('<div class="h5p-inner"></div>').children();
    if (this.options.question.settings.background !== undefined) {
      this.$container.css('backgroundImage', 'url("' + H5P.getPath(this.options.question.settings.background.path, this.id) + '")');
    }

    // Add show score button
    if (this.options.displaySolutionsButton === true) {
      this.addSolutionButton();
    }

    var $element, task = this.options.question.task;

    // Add drop zones
    for (var i = 0; i < task.dropZones.length; i++) {
      var dropZone = task.dropZones[i];

      var html = '<div class="h5p-inner"></div>';
      var extraClass = '';
      if (dropZone.showLabel) {
        html = '<div class="h5p-label">' + dropZone.label + '</div>' + html;
        extraClass = ' h5p-has-label';
      }

      $element = this.addElement(dropZone, 'dropzone' + extraClass, i).html(html).children('.h5p-inner').droppable({
        activeClass: 'h5p-active',
        tolerance: 'intersect',
        accept: function (draggable) {
          // Check that the draggable belongs to this task.
          var $draggable = that.$container.find(draggable);
          if ($draggable.length) {
            // Check that the draggable has this drop zone.
            var id = $(this).parent().data('id');
            var draggableDropZones = task.elements[$draggable.data('id')].dropZones;
            for (var i = 0; i < draggableDropZones.length; i++) {
              if (parseInt(draggableDropZones[i]) === id) {
                return true;
              }
            }
          }
          
          return false;
        },
        drop: function (event, ui) {
          var $this = $(this);
          C.setBackgroundOpacity($this.removeClass('h5p-over'), task.dropZones[$this.parent().data('id')], '224,224,224', '255,255,255');
          ui.draggable.data('addToZone', $this.parent().data('id'));
        },
        over: function (event, ui) {
          var $this = $(this);
          C.setBackgroundOpacity($this.addClass('h5p-over'), task.dropZones[$this.parent().data('id')], '212,190,216', '234,224,236');
        },
        out: function (event, ui) {
          var $this = $(this);
          C.setBackgroundOpacity($this.removeClass('h5p-over'), task.dropZones[$this.parent().data('id')], '224,224,224', '255,255,255');
        }
      }).end();

      C.setBackgroundOpacity($element.children(), dropZone, '224,224,224', '255,255,255');
    }

    // Add elements (static and draggable)
    for (var i = 0; i < task.elements.length; i++) {
      var element = task.elements[i];

      if (element.dropZones !== undefined && element.dropZones.length !== 0) {
        // Add draggable element
        $element = this.$elements[i] = this.addElement(element, 'draggable', i).draggable({
          revert: function (event, ui) {
            var $this = $(this);
            var element = task.elements[$this.data('id')];
            $this.removeClass('h5p-dropped').data("uiDraggable").originalPosition = {
              top: element.y + '%',
              left: element.x + '%'
            };
            C.setElementBackgroundHover($this, element);
            return !event;
          },
          start: function(event, ui) {
            // Send element to the top!
            $(this).detach().appendTo(that.$container);
          },
          stop: function(event, ui) {
            var $this = $(this);
            var position = that.positionToPercentage($this);
            $this.css(position);

            // Remove from zone
            var id = $this.data('id');
            var zone = that.elementZones[id];
            if (zone !== undefined && that.userAnswers[zone] !== undefined) {
              delete that.elementZones[id];
              var zoneAnswers = that.userAnswers[zone];
              for (var i = 0; i < zoneAnswers.length; i++) {
                if (zoneAnswers[i].id === id) {
                  zoneAnswers.splice(i, 1);
                }
              }
            }

            var addToZone = $this.data('addToZone');
            if (addToZone !== undefined) {
              $this.removeData('addToZone');
              that.elementZones[id] = addToZone;

              // Add to zone answers
              if (that.userAnswers[addToZone] === undefined) {
                that.userAnswers[addToZone] = [];
              }
              that.userAnswers[addToZone].push({
                id: id,
                position: position
              });

              $(that).trigger('h5pQuestionAnswered');
                
              $this.addClass('h5p-dropped');
              C.setElementBackgroundHover($this, task.elements[id]);
            }
          }
        });
        C.addHover($element, element);
        C.setElementBackground($element, element);
      }
      else {
        // Add static element
        $element = this.addElement(element, 'static', i);
        C.setBackgroundOpacity($element, element, '255,255,255', '255,255,255');
      }

      var elementInstance = new (H5P.classFromName(element.type.library.split(' ')[0]))(element.type.params, this.id);
      elementInstance.attach($element);
    }

    // Restore user answers
    for (var i = 0; i < that.userAnswers.length; i++) {
      var dropZoneAnswers = that.userAnswers[i];
      if (dropZoneAnswers !== undefined) {
        for (var j = 0; j < dropZoneAnswers.length; j++) {
          var dza = dropZoneAnswers[j];
          this.$elements[dza.id].css(dza.position);
          this.elementZones[dza.id] = i;
        }
      }
    }

    if (this.options.preventResize !== false) {
      this.$.trigger('resize');
    }
  };
  
  /**
   * 
   * @param {type} $element
   * @param {type} element
   * @returns {undefined} 
   */
  C.addHover = function ($element, element) {
    $element.hover(function () {
      C.setElementBackgroundHover($element, element);
    }, function () {
      C.setElementBackground($element, element);
    });
  };
  
  C.setElementBackground = function ($element, element) {
    var colorTop, colorBottom;
      
    if ($element.hasClass('h5p-dropped')) {
      if ($element.hasClass('h5p-wrong')) {
        colorTop = '230,206,209';
        colorBottom = '230,206,209';
      }
      else if ($element.hasClass('h5p-correct')) {
        colorTop = '209,226,206';
        colorBottom = '209,226,206';
      }
      else {
        colorTop = '227,234,238';
        colorBottom = '203,222,231';
      }
    }
    else {
      colorTop = '255,255,255';
      colorBottom = '224,224,224';
    }
              
    C.setBackgroundOpacity($element, element, colorTop, colorBottom);
  };
  
  C.setElementBackgroundHover = function ($element, element) {
    var colorTop, colorBottom;
      
    if ($element.hasClass('h5p-dropped')) {
      if ($element.hasClass('h5p-wrong')) {
        colorTop = '230,206,209';
        colorBottom = '230,206,209';
      }
      else if ($element.hasClass('h5p-correct')) {
        colorTop = '209,226,206';
        colorBottom = '209,226,206';
      }
      else {
        colorTop = '234,224,236';
        colorBottom = '212,190,216';
      }
    }
    else {
      colorTop = '234,224,236';
      colorBottom = '212,190,216';
    }
              
    C.setBackgroundOpacity($element, element, colorTop, colorBottom);
  };

  /**
   * Add solution button to our container.
   */
  C.prototype.addSolutionButton = function () {
    var that = this;

    if (this._$solutionButton !== undefined) {
      return;
    }

    this._$solutionButton = $('<button type="button" class="h5p-button">' + this.options.scoreShow + '</button>').appendTo(this.$container).click(function () {
      if (that._$solutionButton.hasClass('h5p-try-again')) {
        that._$solutionButton.text(that.options.scoreShow).removeClass('h5p-try-again');
        that.hideSolutions();
      }
      else {
        that.showSolutions();
        if (that.options.postUserStatistics === true) {
          H5P.setFinished(that.id, that.getScore(), that.getMaxScore());
        }
      }
    });
  };

  /**
   * Add element/drop zone to task.
   *
   * @param {Object} element
   * @param {String} type Class
   * @param {Number} id
   * @returns {jQuery}
   */
  C.prototype.addElement = function (element, type, id) {
    return $('<div class="h5p-' + type + '" style="left:' + element.x + '%;top:' + element.y + '%;width:' + element.width + 'em;height:' + element.height + 'em"></div>').appendTo(this.$container).data('id', id);
  };

  /**
   * Set correct height of container
   */
  C.prototype.resize = function () {
    // Make sure we use all the height we can get. Needed to scale up.
    this.$container.css('height', '99999px');

    var size = this.options.question.settings.size;
    var ratio = size.width / size.height;
    var width = this.$container.parent().width();
    var height = this.$container.parent().height();

    if (width / height >= ratio) {
      // Wider
      width = height * ratio;
    }
    else {
      // Narrower
      height = width / ratio;
    }

    this.$container.css({
      width: width + 'px',
      height: height + 'px',
      fontSize: (16 * (width / size.width)) + 'px'
    });
  };

  /**
   * Get css position in percentage.
   *
   * @param {jQuery} $element
   * @returns {Object} CSS position
   */
  C.prototype.positionToPercentage = function ($element) {
    return {
      top: (parseInt($element.css('top')) * 100 / this.$container.innerHeight()) + '%',
      left: (parseInt($element.css('left')) * 100 / this.$container.innerWidth()) + '%'
    };
  };

  /**
   * Display the correct solution for the input boxes.
   */
  C.prototype.showSolutions = function (skipVisuals) {
    if (this.displayingSolution) {
      return;
    }

    if (this._$solutionButton !== undefined) {
      if (this.options.enableTryAgain) {
        this._$solutionButton.text(this.options.tryAgain).addClass('h5p-try-again');
      }
      else {
        this._$solutionButton.remove();
      }
    }

    var task = this.options.question.task;
    this.points = 0;

    for (var i = 0; i < this.$elements.length; i++) {
      var $element = this.$elements[i];
      if ($element === undefined) {
        continue;
      }
      var element = task.elements[i];

      // Disable dragging
      if (skipVisuals !== true) $element.draggable('disable');

      // Find out where we are.
      var dropZone = this.elementZones[i];

      if (this.correctDZs[i] === undefined) {
        // We should not be anywhere.
        if (dropZone !== undefined) {
          // ... but we are!
          if (skipVisuals !== true) { 
            $element.addClass('h5p-wrong'); 
            C.setElementBackground($element, element); 
          }
          this.points--;
        }
        continue;
      }

      // Are we somewhere we should be?
      var correct = false;
      for (var j = 0; j < this.correctDZs[i].length; j++) {
        if (dropZone === this.correctDZs[i][j]) {
          correct = true;
          if (skipVisuals !== true) {
            $element.addClass('h5p-correct');
            C.setElementBackground($element, element); 
          }
          this.points++;
          break;
        }
      }
      if (!correct) {
        if (skipVisuals !== true) {
          $element.addClass('h5p-wrong');
          C.setElementBackground($element, element);
        }
      }
    }

    if (skipVisuals !== true) this.displayingSolution = true;
    
    if (this.points < 0) {
      this.points = 0;
    }
    if (this.options.singlePoint) {
      this.points = (this.points === this.calculateMaxScore() ? 1 : 0);
    }
  };

  /**
   * Hide solutions. (/try again)
   */
  C.prototype.hideSolutions = function () {
    for (var i = 0; i < this.$elements.length; i++) {
      if (this.$elements[i] !== undefined) {
        this.$elements[i].removeClass('h5p-wrong h5p-correct').draggable('enable');
        C.setElementBackground(this.$elements[i], this.options.question.task.elements[i]);
      }
    }
    delete this.points;
    this.displayingSolution = false;
  };

  /**
   * Calculates the real max score.
   * 
   * @returns {Number} Max points
   */
  C.prototype.calculateMaxScore = function () {
    var max = 0;
    for (var i = 0; i < this.$elements.length; i++) {
      if (this.$elements[i] !== undefined && this.correctDZs[i] !== undefined) {
        max++;
      }
    }

    return max;
  };

  /**
   * Get maximum score.
   *
   * @returns {Number} Max points
   */
  C.prototype.getMaxScore = function () {
    return (this.options.singlePoint ? 1 : this.calculateMaxScore());
  };

  /**
   * Count the number of correct answers.
   * Only works while showing solution.
   *
   * @returns {Number} Points
   */
  C.prototype.getScore = function () {
    // TODO: Refactor. This function shouldn't rely on showSolutions
    this.showSolutions(true);
    var points = this.points;
    delete this.points;
    return points;
  };

  /**
   * Checks if all has been answered.
   *
   * @returns {Boolean}
   */
  C.prototype.getAnswerGiven = function () {
    return this.userAnswers.length !== 0;
  };
  
  /**
   * Gather copyright information for the current content.
   *
   * @returns {H5P.ContentCopyright}
   */
  C.prototype.getCopyrights = function () {
    var self = this;
    var info = new H5P.ContentCopyrights();
    
    var background = self.options.question.settings.background;
    if (background !== undefined && background.copyright !== undefined) {
      var image = new H5P.MediaCopyright(background.copyright);
      image.setThumbnail(new H5P.Thumbnail(H5P.getPath(background.path, self.id), background.width, background.height));
      info.addMedia(image);
    }
    
    for (var i = 0; i < self.options.question.task.elements.length; i++) {
      var element = self.options.question.task.elements[i];
      var instance = H5P.newRunnable(element.type, self.id);
      
      if (instance.getCopyrights !== undefined) {
        var rights = instance.getCopyrights();
        rights.setLabel(element.dropZones.length ? 'Draggable ' : 'Static ') + (element.type.params.contentName !== undefined ? element.type.params.contentName : 'element');
        info.addContent(rights);
      }
    }
    
    return info;
  };

  /**
   * Sets background opacity for the given element.
   *
   * @param {jQuery} $element
   * @param {Object} element
   * @param {String} color
   */
  C.setBackgroundOpacity = function ($element, element, colorTop, colorBottom) {
    if (element.backgroundOpacity === undefined) {
      element.backgroundOpacity = 100;
    }
    $element.css('backgroundColor', 'rgba(' + colorTop + ',' + (element.backgroundOpacity / 100) + ')');
    $element.css('background', 'linear-gradient(to bottom, rgba(' + colorTop + ',' + (element.backgroundOpacity / 100) + ') 0%,rgba(' + colorBottom + ',' + (element.backgroundOpacity / 100) + ') 100%)');
  };

  return C;
})(H5P.jQuery);
