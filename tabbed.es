const moo = require('@webhare-system/frameworks/mootools/core')
const pagemgr = require('./pagemanager');
const $=moo.$

let TabControl = new Class(
{ Implements: [ Options, Events ]
, options: {}
, pagemgr: null
, tabholder: null

, initialize: function(tabholder, options)
  {
    if(options && options.pagemgr)
    {
      this.pagemgr = options.pagemgr;
      delete options.pagemgr;
    }
    this.setOptions(options);

    this.tabholder = $(tabholder);
    this.tabholder.addEvent("click:relay(*[data-tab-for])", this.onSelectTab.bind(this));

    if (!this.pagemgr)
    {
      this.pagemgr = new pagemgr.PageManager;
      this.getTabs().each(function(tab)
      {
        var node = $(tab.getAttribute("data-tab-for"));
        if (node && node.hasClass("wh-page"))
          this.pagemgr.addPage(new pagemgr.PageBase( { node: node }));
      }, this);
    }

    this.updateSelectedTab();

    this.pagemgr.addEvent('pagechange', this.updateSelectedTab.bind(this));
    this.pagemgr.start();
  }

, onSelectTab:function(event, tabnode)
  {
    event.stop();
    this.setCurrentTab(tabnode.getAttribute('data-tab-for'));
  }

, getTabs:function()
  {
    return this.tabholder.getElements('*[data-tab-for]');
  }

, setCurrentTab: function(tabid)
  {
    var desttab = this.pagemgr.findPage(tabid);
    if(!desttab)
      return;

    this.pagemgr.start(desttab);
  }

, getCurrentTab: function()
  {
    return this.pagemgr.getCurrentPage();
  }

, updateSelectedTab: function()
  {
    var selectedtab = this.getCurrentTab() ? this.getCurrentTab().id : '';
    Array.each(this.getTabs(), function(node)
    {
      node.toggleClass('selected', node.getAttribute('data-tab-for') == selectedtab);
    });
    this.fireEvent("tabchange", { target: this });
  }
})

let Tabbed = new moo.Class(
{ Implements: [moo.Options]
, pagemgr: null
, tabcontrol: null
, handler: null
, disableleavecheck: false
, options: { leavedirtycallback: null
           , submitontabchange: false
           }
, initialize: function(formhandler, options)
  {
    if(!formhandler)
      throw "Formhandler not set";

    if(options && options.pagemgr)
    {
      this.pagemgr = options.pagemgr;
      delete options.pagemgr;
    }
    this.setOptions(options);

    this.handler = formhandler;
    if(!this.pagemgr)
    {
      this.pagemgr = new pagemgr.PageManager;
      var skipnodes = this.handler.form.getElements('.wh-page .wh-page');
      Array.each(this.handler.form.getElements('.wh-page'), function(node)
      {
        if(skipnodes.contains(node))
          return;
        this.pagemgr.addPage(new pagemgr.PageBase( { node: node }));
      }.bind(this));
    }
    this.pagemgr.addEvent("beforepageleave", this.onBeforeTabLeave.bind(this))

    if(!options || !options.tabholder)
      throw "A tabholder must currently be explicitly specified";

    this.tabcontrol = new TabControl(options.tabholder, { pagemgr: this.pagemgr });

    this.handler.addEvent("formaction", this.onFormAction.bind(this))
    this.handler.addEvent("dirtychange", this.onDirtyChange.bind(this));
  }
, onFormAction:function(event)
  {
    if(event.formaction == 'goto-previous' || event.formaction == 'goto-next')
    {
      event.stop();
      var targetpage = event.formaction == 'goto-previous' ? this.pagemgr.getPreviousPage() : this.pagemgr.getNextPage();
      if(targetpage)
        this.pagemgr.start(targetpage);
      return;
    }
    if(event.formaction == 'submit-tab' || event.formaction == 'submit-tab-next' || event.formaction == 'submit-tab-previous')
    {
      event.stop();
      var targetpage = event.formaction == 'submit-tab-previous' ? this.pagemgr.getPreviousPage()
                      : event.formaction == 'submit-tab-next' ? this.pagemgr.getNextPage()
                      : null;

      this.handler.__validateAndSubmitPart(this.pagemgr.getCurrentPage().node, null, (function() { if(targetpage) this.pagemgr.start(targetpage) }).bind(this));
      return;
    }
  }
, onDirtyChange:function(event)
  {
    Array.each(this.pagemgr.pages,function(page)
    {
      page.node.toggleClass('tabdirty', this.handler.isPartDirty(page.node));
    }.bind(this));
  }

, onBeforeTabLeave:function(event)
  {
    if(!this.handler.isPartDirty(event.currentpage.node))
      return;

    if(this.options.submitontabchange)
    {
      event.stop();
      this.handler.__validateAndSubmitPart(event.currentpage.node, null, (function() { this.pagemgr.start(event.nextpage) }).bind(this));
      return;
    }

    if(!this.options.leavedirtycallback || this.disableleavecheck)
      return;

    event.stop();
    var submitcallback = this.tabLeaveCallback.bind(this, event.currentpage, event.nextpage);
    this.options.leavedirtycallback(event.currentpage, submitcallback);
  }
, tabLeaveCallback:function(fromtab, desttab, action)
  {
    if(!['save','discard','ignore','revert'].contains(action))
      throw "Invalid action '" + action + "', expect save, discard, revert or ignore";

    if(action=='discard' || action=='revert')
      this.handler.resetPart(fromtab.node);
    if(action=='discard' || action=='ignore')
    {
      this.disableleavecheck = true;
      this.pagemgr.start(desttab);
      this.disableleavecheck = false;
    }
    if(action!='save') //discard, ignore and revert
      return;

    //submit and only continue on success
    this.handler.__validateAndSubmitPart(fromtab.node, null, (function() { this.pagemgr.start(desttab) }).bind(this));
  }
});

module.exports = Tabbed;
