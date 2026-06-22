sap.ui.define(
    ["sap/fe/core/AppComponent", "sap/m/MessageToast"],
    function (AppComponent, MessageToast) {
        "use strict";

        return AppComponent.extend("my.first.approvals.Component", {
            metadata: {
                manifest: "json"
            },

            init: function () {
                AppComponent.prototype.init.apply(this, arguments);
                console.log("[AR-Component] init called — setting up button injection");
                this._setupRouteInjection();
            },

            _setupRouteInjection: function () {
                var that = this;
                var oRouter = this.getRouter();
                if (!oRouter) {
                    console.log("[AR-Component] No router found, trying polling");
                    this._startPolling();
                    return;
                }
                console.log("[AR-Component] Router found, attaching routeMatched");
                oRouter.attachRouteMatched(function (oEvent) {
                    var sRouteName = oEvent.getParameter("name");
                    console.log("[AR-Component] Route matched:", sRouteName);
                    if (sRouteName === "ApprovalRequestsObjectPage") {
                        that._injectAfterDelay();
                    }
                });
            },

            _injectAfterDelay: function () {
                var that = this;
                // Wait for the page to render, then inject
                var iCount = 0;
                var iMaxAttempts = 20;
                var interval = setInterval(function () {
                    iCount++;
                    var oTitleEl = document.querySelector(".sapFDynamicPageTitle");
                    if (oTitleEl) {
                        var oActions = oTitleEl.querySelector(".sapFDynamicPageTitleActions");
                        if (oActions && !oActions.querySelector("[data-ar-btn]")) {
                            clearInterval(interval);
                            that._injectButtons(oActions);
                        } else if (oActions && oActions.querySelector("[data-ar-btn]")) {
                            clearInterval(interval);
                        }
                    }
                    if (iCount >= iMaxAttempts) {
                        clearInterval(interval);
                        console.log("[AR-Component] Gave up waiting for DynamicPageTitle after", iMaxAttempts, "attempts");
                    }
                }, 300);
            },

            _startPolling: function () {
                var that = this;
                // Fallback: poll for ObjectPage regardless of routing
                setInterval(function () {
                    var oTitleEl = document.querySelector(".sapFDynamicPageTitle");
                    if (oTitleEl) {
                        var oActions = oTitleEl.querySelector(".sapFDynamicPageTitleActions");
                        if (oActions && !oActions.querySelector("[data-ar-btn]")) {
                            that._injectButtons(oActions);
                        }
                    }
                }, 1000);
            },

            _injectButtons: function (oActionsContainer) {
                console.log("[AR-Component] Injecting Approve/Reject buttons");
                var that = this;

                // Create Approve button
                var oApproveBtn = document.createElement("button");
                oApproveBtn.setAttribute("data-ar-btn", "approve");
                oApproveBtn.className = "sapMBtn sapMBtnBase sapMBtnEmphasized sapMBtn sapMOverflowToolbarButton";
                oApproveBtn.style.marginLeft = "0.5rem";
                oApproveBtn.style.cssText += "display:inline-flex;align-items:center;height:2.25rem;padding:0 0.75rem;border-radius:0.5rem;background:#36a800;color:white;border:none;cursor:pointer;font-size:0.875rem;font-family:inherit;gap:0.375rem;";
                oApproveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Approve</span>';
                oApproveBtn.onclick = function () {
                    that._callAction("approve");
                };

                // Create Reject button
                var oRejectBtn = document.createElement("button");
                oRejectBtn.setAttribute("data-ar-btn", "reject");
                oRejectBtn.style.cssText += "display:inline-flex;align-items:center;height:2.25rem;padding:0 0.75rem;border-radius:0.5rem;background:#bb0000;color:white;border:none;cursor:pointer;font-size:0.875rem;font-family:inherit;margin-left:0.375rem;gap:0.375rem;";
                oRejectBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L4 12M4 4l8 8" stroke="white" stroke-width="2" stroke-linecap="round"/></svg><span>Reject</span>';
                oRejectBtn.onclick = function () {
                    that._callAction("reject");
                };

                oActionsContainer.appendChild(oApproveBtn);
                oActionsContainer.appendChild(oRejectBtn);
                console.log("[AR-Component] Buttons injected successfully");
            },

            _callAction: function (sAction) {
                console.log("[AR-Component] Action called:", sAction);
                var oModel = this.getModel();
                if (!oModel) {
                    MessageToast.show("Model not available");
                    return;
                }

                // Get the current entity from the ObjectPage binding context
                var oContext = this._getCurrentContext();
                if (!oContext) {
                    MessageToast.show("No approval request selected");
                    return;
                }

                var sId = oContext.ID;
                var sComment = "";

                // For reject, prompt for comment
                if (sAction === "reject") {
                    var sComment = prompt("Reason for rejection (required):");
                    if (!sComment || !sComment.trim()) {
                        MessageToast.show("A comment is required for rejection");
                        return;
                    }
                    sComment = sComment.trim();
                }

                var that = this;
                console.log("[AR-Component] Calling /" + sAction, { ID: sId, comment: sComment });

                oModel.callFunction("/" + sAction, {
                    method: "POST",
                    parameters: { ID: sId, comment: sComment }
                }).then(function () {
                    MessageToast.show(sAction.charAt(0).toUpperCase() + sAction.slice(1) + " successfully");
                    oModel.refresh();
                }).catch(function (oError) {
                    var sMsg = "Error on " + sAction;
                    try {
                        var oBody = JSON.parse(oError.responseText);
                        sMsg = oBody.error && oBody.error.message ? oBody.error.message : sMsg;
                    } catch (e) {
                        sMsg = oError.message || sMsg;
                    }
                    MessageToast.show(sMsg);
                });
            },

            _getCurrentContext: function () {
                // Find the ObjectPage in the DOM and get its binding context
                var oObjectPage = document.querySelector(".sapMObjectPage");
                if (!oObjectPage) return null;

                // Try to find the UI5 control via the DOM element's ID
                var sId = oObjectPage.id;
                var oControl = sap.ui.getCore().byId(sId);
                if (oControl && oControl.getBindingContext) {
                    var oCtx = oControl.getBindingContext();
                    if (oCtx) return oCtx.getObject();
                }

                // Fallback: look for binding context in a hidden input or data attribute
                var oBindingEl = oObjectPage.querySelector("[data-sap-ui]");
                return null;
            }
        });
    }
);
