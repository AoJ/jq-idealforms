/**
 * @namespace jq-idealforms jQuery plugin
 */
$.fn.idealforms = function (ops) {

  var

  // Default options
  o = $.extend({
    inputs: {},
    customFilters: {},
    customFlags: {},
    globalFlags: '',
    onSuccess: function (e) {
      alert('Thank you...')
    },
    onFail: function () {
      alert('The form does not validate! Check again...')
    },
    responsiveAt: 'auto',
    customInputs: true
  }, ops),

  $form = this, // The form

  /**
   * @namespace All form inputs of the given form
   * @memberOf $.fn.idealforms
   * @returns {object}
   */
  FormInputs = function () {
    return {
      inputs: $form.find('input, select, textarea, :button'),
      labels: $form.find('div > label:first-child'),
      text: $form.find('input:not([type="checkbox"], [type="radio"]), textarea'),
      select: $form.find('select'),
      radiocheck: $form.find('input[type="radio"], input[type="checkbox"]'),
      buttons: $form.find(':button'),
      file: $form.find('[type="file"]')
    }
  },
  /**
   * All inputs specified by the user
   */
  UserInputs = function () {
    return $(
      '[name="'+ Utils.getKeys(o.inputs).join('"], [name="') +'"],' + // by name attribute
      '.' + Utils.getKeys(Filters).join(', .') // by class
    )
  },

/*--------------------------------------------------------------------------*/

  /**
  * @namespace Contains LESS data
  */
  LessVars = {
    fieldWidth: Utils.getLessVar('ideal-field-width', 'width')
  },

/*--------------------------------------------------------------------------*/

  /**
   * @namespace Methods of the form
   * @memberOf $.fn.idealforms
   */
  Actions = {
    /**
     * Generate markup for any given input
     * @memberOf Actions
     */
    doMarkup: function ($input) {

      var

      type = Utils.getInputType($input),

      // Append errors and icons
      addValidationEls = function () {
        // Validation elements
        var
        $error = $('<span class="error" />'),
        $valid = $('<i class="icon valid-icon" />'),
        $invalid = $('<i/>', {
          'class': 'icon invalid-icon',
          click: function () {
            var $this = $(this)
            if ($this.siblings('label').length) // radio & check
              $this.siblings('label:first').find('input').focus()
            else $this.siblings('input, select, textarea').focus()
          }
        })
        $input.parents('.ideal-field')
          .append($valid.add($invalid).hide())
          .after($error.hide())
      },

      // Input Types
      inputTypes = {
        'default': function () {
          $input.wrapAll('<span class="ideal-field"/>')
          addValidationEls()
        },
        button: function () {
          if (o.customInputs) $input.addClass('ideal-button')
        },
        file: function () {
          inputTypes['default']()
          if (o.customInputs) $input.toCustomFile()
        },
        select: function () {
          inputTypes['default']()
          if (o.customInputs) $input.toCustomSelect()
        },
        text: function () { inputTypes['default']() },
        radiocheck: function () {
          var isWrapped = $input.parents('.ideal-field').length,
              $all = $input.parent().siblings('label:not(:first)').andSelf()
          if (o.customInputs) $input.toCustomRadioCheck()
          if (!isWrapped) {
            $all.wrapAll('<span class="ideal-field ideal-radiocheck"/>')
            addValidationEls()
          } else {
            return false
          }
        }
      }

      // Wrapper
      $input.closest('div').addClass('ideal-wrap')

      inputTypes[type]()

    },

    /**
     * Adjust form
     * @memberOf Actions
     */
    adjust: function () {
      var formInputs = FormInputs()

      // Adjust labels
      formInputs.labels
        .addClass('ideal-label')
        .width(Utils.getMaxWidth(formInputs.labels))

      // Placeholder support
      if (!('placeholder' in $('<input/>')[0])) {
        formInputs.text.each(function () {
          $(this).val($(this).attr('placeholder'))
        }).on({
          focus: function () {
            if (this.value === $(this).attr('placeholder')) $(this).val('')
          },
          blur: function () {
            $(this).val() || $(this).val($(this).attr('placeholder'))
          }
        })
      }
    },

    /**
     * Initializate form
     * @memberOf Actions
     */
    init: function () {
      var formInputs = FormInputs()
      $form.css('visibility', 'visible').addClass('ideal-form')
      // Add novalidate tag if HTML5.
      $form.attr('novalidate', 'novalidate')
      // Autocomplete causes some problems...
      formInputs.inputs.attr('autocomplete', 'off')
      Actions.adjust()
      formInputs.inputs.each(function(){ Actions.doMarkup($(this)) })
    },

    /** Validates an input
     * @memberOf Actions
     * @param {object} input Object that contains the jQuery input object [input.input]
     * and the user options of that input [input.userOptions]
     * @param {string} value The value of the given input
     * @returns {object} Returns [isValid] plus [error] if it fails
     */
    validate: function (input, value) {

      var isValid = true,
          error = '',
          $input = input.input,
          userOptions = input.userOptions,
          userFilters = userOptions.filters

      if (userFilters) {

        // Required
        if (!value && /required/.test(userFilters)) {
          error = (
            userOptions.errors && userOptions.errors.required
              ? userOptions.errors.required
              : Filters.required.error
          )
          isValid = false
        }

        // All other filters
        if (value) {
          userFilters = userFilters.split(/\s/)
          for (var i = 0, len = userFilters.length; i < len; i++) {
            var uf = userFilters[i],
                theFilter = Filters[uf] || ''
            if (
              theFilter && (
                Utils.isFunction(theFilter.regex) && !theFilter.regex(input, value) ||
                Utils.isRegex(theFilter.regex) && !theFilter.regex.test(value)
              )
            ) {
              isValid = false
              error = (
                userOptions.errors && userOptions.errors[uf] ||
                theFilter.error
              )
              break
            }
          }
        }

      }

      return {
        isValid: isValid,
        error: error
      }
    },

    /** Shows or hides validation errors and icons
     * @memberOf Actions
     * @param {object} input jQuery object
     * @param {string} evt The event on which `analyze()` is being called
     */
    analyze: function (input, evt) {

      var

      isRadiocheck = input.is('[type="checkbox"], [type="radio"]'),
      isFile = input.is('[type="file"]'),

      $input = (function(){
        var userInputs = UserInputs()
        if (isRadiocheck)
          return userInputs.filter('[name="' + input.attr('name') + '"]')
        return userInputs.filter(input)
      }()),

      userOptions = (
        o.inputs[input.attr('name')] || // by name attribute
        { filters: input.attr('class') } // by class
      ),
      value = (function () {
        var iVal = input.val()
        if (iVal === input.attr('placeholder')) return
        // Always send a value when validating
        // [type="checkbox"] and [type="radio"]
        if (isRadiocheck) return userOptions && ' '
        return iVal
      }()),

      $field = input.parents('.ideal-field'),
      $error = $field.next('.error'),
      $invalid = (function () {
        if (isRadiocheck) return input.parent().siblings('.invalid-icon')
        return input.siblings('.invalid-icon')
      }()),
      $valid = (function () {
        if (isRadiocheck) return input.parent().siblings('.valid-icon')
        return input.siblings('.valid-icon')
      }()),

      // Validate
      test = Actions.validate({
        input: $input,
        userOptions: userOptions
      }, value),

      // Flags
      flags = (function(){
        // Input flags
        var f = userOptions.flags ? userOptions.flags : ''
        // Append global flags
        if (o.globalFlags) f += o.globalFlags
        return f.split(/\s/)
      }()),
      doFlags = function () {
        for (var i = 0, len = flags.length, f; i < len; i++) {
          f = flags[i]
          if (Flags[f]) Flags[f]($input, evt)
          else break
        }
      }

      // Reset
      $field.removeClass('valid invalid').data('isValid', true)
      $error.add($invalid).add($valid).hide()

      // Validates
      if (value && test.isValid) {
        $error.add($invalid).hide()
        $field.addClass('valid').data('isValid', true)
        $valid.show()
      }
      // Does NOT validate
      if (!test.isValid) {
        $invalid.show()
        $field.addClass('invalid').data('isValid', false)
        // error
        $form.find('.error').hide()
        if (evt !== 'blur') // hide on blur
          $error.html(test.error).show()
      }

      doFlags()
    },

    /**
     * Attach all validation events to specified user inputs
     * @memberOf Actions
     */
    attachEvents: function () {
      UserInputs()
        .on('keyup change focus blur', function (e) {
          Actions.analyze($(this), e.type)
        })
    },

    /** Deals with responsiveness aka adaptation
     * @memberOf Actions
     */
    responsive: function () {

      var

      formInputs = FormInputs(),

      maxWidth = LessVars.fieldWidth + formInputs.labels.outerWidth(),
      $emptyLabel = formInputs.labels.filter(function () {
        return $(this).html() === '&nbsp;'
      }),
      $customSelect = $form.find('.ideal-select')

      if (o.responsiveAt === 'auto') {
        $form.width() < maxWidth
          ? $form.addClass('stack')
          : $form.removeClass('stack')
      } else {
        $(window).width() < o.responsiveAt
          ? $form.addClass('stack')
          : $form.removeClass('stack')
      }

      if ($form.is('.stack')) {
        $emptyLabel.hide()
        $customSelect.trigger('list')
      } else {
        $emptyLabel.show()
        $customSelect.trigger('menu')
      }

    }
  },

/*-------------------------------------------------------------------------*/

  /**
  * @namespace Public methods
  */
  PublicMethods = {

    addFields: function (fields) {

      // Reverse array to insert in DOM
      // in proper order
      fields = fields.reverse()

      var add = function (ops) {
        var

        addAfter = (
          ops.addAfter
            ? $( Utils.getByNameOrId(ops.addAfter) ).parents('.ideal-wrap')
            : $form.find('.ideal-wrap').last() // Insert after last field
        ),

        name = ops.name,

        // User options
        userOptions = {
          filters: ops.filters || '',
          data: ops.data || {},
          errors: ops.errors || {},
          flags: ops.flags || ''
        },

        // Markup
        title = ops.title,
        markup = ops.markup,
        $field = $(
          '<div>'+
            '<label>'+ title +':</label>'+ markup +
          '</div>'
        ),
        $input = $field.find('input, select, textarea, :button')

        // Add user options
        o.inputs[name] = userOptions

        Actions.doMarkup($input)
        $field.insertAfter(addAfter)
      }

      // Run through each input
      for (var i = 0, len = fields.length; i < len; i++)
        add(fields[i])

      // Reload form
      $form.reload()
    },

    getInvalid: function () {
      return $form.find('.ideal-field').filter(function () {
          return $(this).data('isValid') === false
        })
    },

    isValid: function () {
      return !$form.getInvalid().length
    },

    isValidField: function (str) {
      var $input = Utils.getByNameOrId(str)
      return $input.parents('.ideal-field').data('isValid') === true
    },

    focusFirst: function () {
      $form.find('input:first').focus();
      return $form
    },

    focusFirstInvalid: function () {
      $form
        .getInvalid()
        .first()
        .find('input:first')
        .focus()
      return $form
    },

    fresh: function () {
      UserInputs()
        .blur()
        .parents('.ideal-field')
        .removeClass('valid invalid')
      return $form
    },

    reload: function () {
      Actions.adjust()
      Actions.attachEvents()
      $form.fresh()
    },

    reset: function () {
      var formInputs = FormInputs()
      formInputs.text.val('') // text inputs
      formInputs.radiocheck.removeAttr('checked') // [type="radio"] & [type="checkbox"]
      // Select and custom select
      formInputs.select.find('option').first().prop('selected', true)
      $form.find('.ideal-select').trigger('reset')
      // Reset all
      formInputs.inputs.change().blur()
      $form.focusFirst()
      return $form
    }
  }

/*--------------------------------------------------------------------------*/

  // attach public methods
  for (var m in PublicMethods) $form[m] = PublicMethods[m]

  $form.on({
    keydown: function (e) {
      // Prevent submit when pressing enter
      if (e.which === 13) e.preventDefault()
    },
    submit: function (e) {
      if (!$form.isValid()) {
        e.preventDefault()
        o.onFail()
        $form.focusFirstInvalid()
      }
      else o.onSuccess(e)
    }
  })

  // Responsive
  if (o.responsiveAt) {
    $(window).resize(Actions.responsive)
    Actions.responsive()
  }

  // Merge custom and default filters
  $.extend(true, Filters, o.customFilters)

  // Merge custom and default flags
  $.extend(true, Flags, o.customFlags)

  // Start form
  Actions.init()
  Actions.attachEvents()
  $form.fresh()

  return this

}
