if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5 internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }

    var aArgs = Array.prototype.slice.call(arguments, 1), 
        fToBind = this, 
        fNOP = function () {},
        fBound = function () {
          return fToBind.apply(this instanceof fNOP && oThis
                                 ? this
                                 : oThis,
                               aArgs.concat(Array.prototype.slice.call(arguments)));
        };

    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();

    return fBound;
  };
}
(function() {

  'use strict';

  angular
    .module('flowchart', ['flowchart-templates']);

}());

(function() {

  'use strict';

  /**
   *
   * @returns {Function}
   * @constructor
   */
  function Topsortservice() {
    /**
     * @returns An array of node ids as string. ['idOfFirstNode', 'idOfSecondNode', ...]. Tbis is not exactly the best way to return ids, but until now there is no need for a better return.
     */
    return function(graph) {

      // Build adjacent list with incoming and outgoing edges.
      var adjacentList = {};
      angular.forEach(graph.nodes, function(node) {
        adjacentList[node.id] = {incoming: 0, outgoing: []};
      });
      angular.forEach(graph.edges, function(edge) {
        var sourceNode = graph.nodes.filter(function(node) {
          return node.connectors.some(function(connector) {
            return connector.id === edge.source;
          })
        })[0];
        var destinationNode = graph.nodes.filter(function(node) {
          return node.connectors.some(function(connector) {
            return connector.id === edge.destination;
          })
        })[0];

        adjacentList[sourceNode.id].outgoing.push(destinationNode.id);
        adjacentList[destinationNode.id].incoming++;
      });

      var orderedNodes = [];
      var sourceNodes = [];
      angular.forEach(adjacentList, function(edges, node) {
        if (edges.incoming === 0) {
          sourceNodes.push(node);
        }
      });
      while (sourceNodes.length !== 0) {
        var sourceNode = sourceNodes.pop();
        for (var i = 0; i < adjacentList[sourceNode].outgoing.length; i++) {
          var destinationNode = adjacentList[sourceNode].outgoing[i];
          adjacentList[destinationNode].incoming--;
          if (adjacentList[destinationNode].incoming === 0) {
            sourceNodes.push('' + destinationNode);
          }
          adjacentList[sourceNode].outgoing.splice(i, 1);
          i--;
        }
        orderedNodes.push(sourceNode);
      }

      var hasEdges = false;
      angular.forEach(adjacentList, function(edges) {
        if (edges.incoming !== 0) {
          hasEdges = true;
        }
      });
      if (hasEdges) {
        return null;
      } else {
        return orderedNodes;
      }

    }
  }

  angular.module('flowchart')
    .factory('Topsortservice', Topsortservice);
})();

(function() {

  'use strict';

  function Nodedraggingfactory() {
    return function(modelservice, nodeDraggingScope, applyFunction) {

      var dragOffset = {};
      nodeDraggingScope.draggedNode = null;

      function getCoordinate(coordinate, max) {
        coordinate = Math.max(coordinate, 0);
        coordinate = Math.min(coordinate, max);
        return coordinate;
      }
      function getXCoordinate(x) {
        return getCoordinate(x, modelservice.getCanvasHtmlElement().offsetWidth);
      }
      function getYCoordinate(y) {
        return getCoordinate(y,  modelservice.getCanvasHtmlElement().offsetHeight);
      }
      return {
        dragstart: function(node) {
          return function(event) {
            modelservice.deselectAll();
            modelservice.nodes.select(node);
            nodeDraggingScope.draggedNode = node;

            var element = angular.element(event.target);
            dragOffset.x = parseInt(element.css('left')) - event.clientX;
            dragOffset.y = parseInt(element.css('top')) - event.clientY;

            event.dataTransfer.setData('Text', 'Just to support firefox');
            if (event.dataTransfer.setDragImage) {
              var invisibleDiv = angular.element('<div></div>')[0]; // This divs stays invisible, because it is not in the dom.
              event.dataTransfer.setDragImage(invisibleDiv, 0, 0);
            } else {
              event.target.style.display = 'none'; // Internetexplorer does not support setDragImage, but it takes an screenshot, from the draggedelement and uses it as dragimage.
              // Since angular redraws the element in the next dragover call, display: none never gets visible to the user.
            }
          };
        },

        drop: function(event) {
          if (nodeDraggingScope.draggedNode) {
            return applyFunction(function() {
              nodeDraggingScope.draggedNode.x = getXCoordinate(dragOffset.x + event.clientX);
              nodeDraggingScope.draggedNode.y = getYCoordinate(dragOffset.y + event.clientY);
              event.preventDefault();
              return false;
            })
          }
        },

        dragover: function(event) {
          if (nodeDraggingScope.draggedNode) {
            return applyFunction(function() {
              nodeDraggingScope.draggedNode.x = getXCoordinate(dragOffset.x + event.clientX);
              nodeDraggingScope.draggedNode.y =  getYCoordinate(dragOffset.y + event.clientY);
              event.preventDefault();
              return false;
            });
          }
        },

        dragend: function(event) {
          if (nodeDraggingScope.draggedNode) {
            nodeDraggingScope.draggedNode = null;
            dragOffset.x = 0;
            dragOffset.y = 0;
          }
        }
      };
    };
  }

  angular
    .module('flowchart')
    .factory('Nodedraggingfactory', Nodedraggingfactory);

}());

(function() {

  'use strict';

  function fcNode(flowchartConstants) {
    return {
      restrict: 'E',
      templateUrl: 'flowchart/node.html',
      replace: true,
      scope: {
        callbacks: '=',
        node: '=',
        selected: '=',
        underMouse: '=',
        mouseOverConnector: '=',
        modelservice: '=',
        draggedNode: '='
      },
      link: function(scope, element) {
        scope.flowchartConstants = flowchartConstants;
        element.attr('draggable', 'true');

        element.on('dragstart', scope.callbacks.nodeDragstart(scope.node));
        element.on('dragend', scope.callbacks.nodeDragend);
        element.on('click', scope.callbacks.nodeClicked(scope.node));
        element.on('mouseenter', scope.callbacks.nodeMouseEnter(scope.node));
        element.on('mouseleave', scope.callbacks.nodeMouseLeave(scope.node));

        element.addClass(flowchartConstants.nodeClass);

        function myToggleClass(clazz, set) {
          if (set) {
            element.addClass(clazz);
          } else {
            element.removeClass(clazz);
          }
        }

        scope.$watch('selected', function(value) {
          myToggleClass(flowchartConstants.selectedClass, value);
        });
        scope.$watch('underMouse', function(value) {
          myToggleClass(flowchartConstants.hoverClass, value);
        });
        scope.$watch('draggedNode', function(value) {
          myToggleClass(flowchartConstants.draggingClass, value);
        });
      }
    };
  }
  fcNode.$inject = ["flowchartConstants"];

  angular.module('flowchart').directive('fcNode', fcNode);
}());

(function() {

  'use strict';

  function Mouseoverfactory() {
    return function(mouseoverscope, applyFunction) {
      var mouseoverservice = {};

      mouseoverscope.connector = null;
      mouseoverscope.edge = null;
      mouseoverscope.node = null;

      mouseoverservice.nodeMouseEnter = function(node) {
        return function(event) {
          return applyFunction(function() {
            mouseoverscope.node = node;
          });
        };
      };

      mouseoverservice.nodeMouseLeave = function(node) {
        return function(event) {
          return applyFunction(function() {
            mouseoverscope.node = null;
          });
        };
      };

      mouseoverservice.connectorMouseEnter = function(connector) {
        return function(event) {
          return applyFunction(function() {
            mouseoverscope.connector = connector;
          });
        };
      };

      mouseoverservice.connectorMouseLeave = function(connector) {
        return function(event) {
          return applyFunction(function() {
            mouseoverscope.connector = null
          });
        };
      };

      mouseoverservice.edgeMouseEnter = function(event, edge) {
        mouseoverscope.edge = edge;
      };

      mouseoverservice.edgeMouseLeave = function(event, egde) {
        mouseoverscope.edge = null;
      };

      return mouseoverservice;
    };
  }

  angular.module('flowchart')
    .factory('Mouseoverfactory', Mouseoverfactory);
}());


(function() {

  'use strict';

  function Modelvalidation(Topsortservice, flowchartConstants) {

    function ModelvalidationError(message) {
      this.message = message;
    }
    ModelvalidationError.prototype = new Error;
    ModelvalidationError.prototype.name = 'ModelvalidationError';
    ModelvalidationError.prototype.constructor = ModelvalidationError;
    this.ModelvalidationError = ModelvalidationError;

    this.validateModel = function(model) {
      this.validateNodes(model.nodes);
      this._validateEdges(model.edges, model.nodes);
      return model;
    };

    this.validateNodes = function(nodes) {
      var that = this;

      var ids = [];
      angular.forEach(nodes, function(node) {
        that.validateNode(node);
        if (ids.indexOf(node.id) !== -1) {
          throw new ModelvalidationError('Id not unique.');
        }
        ids.push(node.id);
      });

      var connectorIds = [];
      angular.forEach(nodes, function(node) {
        angular.forEach(node.connectors, function(connector) {
          if (connectorIds.indexOf(connector.id) !== -1) {
            throw new ModelvalidationError('Id not unique.');
          }
          connectorIds.push(connector.id);
        });
      });
      return nodes;
    };

    this.validateNode = function(node) {
      var that = this;
      if (node.id === undefined) {
        throw new ModelvalidationError('Id not valid.');
      }
      if (typeof node.name !== 'string') {
        throw new ModelvalidationError('Name not valid.');
      }
      if (typeof node.x !== 'number' || node.x < 0 || Math.round(node.x) !== node.x) {
        throw new ModelvalidationError('Coordinates not valid.')
      }
      if (typeof node.y !== 'number' || node.y < 0 || Math.round(node.y) !== node.y) {
        throw new ModelvalidationError('Coordinates not valid.')
      }
      if (!Array.isArray(node.connectors)) {
        throw new ModelvalidationError('Connectors not valid.');
      }
      angular.forEach(node.connectors, function(connector) {
        that.validateConnector(connector);
      });
      return node;
    };

    this._validateEdges = function(edges, nodes) {
      var that = this;

      angular.forEach(edges, function(edge) {
        that._validateEdge(edge, nodes);
      });
      angular.forEach(edges, function(edge1, index1) {
        angular.forEach(edges, function(edge2, index2) {
          if (index1 !== index2) {
            if ((edge1.source === edge2.source && edge1.destination === edge2.destination) || (edge1.source === edge2.destination && edge1.destination === edge2.source)) {
              throw new ModelvalidationError('Duplicated edge.')
            }
          }
        });
      });

      if (Topsortservice({nodes: nodes, edges: edges}) === null) {
        throw new ModelvalidationError('Graph has a circle.');
      }

      return edges;
    };

    this.validateEdges = function(edges, nodes) {
      this.validateNodes(nodes);
      return this._validateEdges(edges, nodes);
    };

    this._validateEdge = function(edge, nodes) {
      if (edge.source === undefined) {
        throw new ModelvalidationError('Source not valid.');
      }
      if (edge.destination === undefined) {
        throw new ModelvalidationError('Destination not valid.');
      }

      if (edge.source === edge.destination) {
        throw new ModelvalidationError('Edge with same source and destination connectors.');
      }
      var sourceNode = nodes.filter(function(node) {return node.connectors.some(function(connector) {return connector.id === edge.source})})[0];
      if (sourceNode === undefined) {
        throw new ModelvalidationError('Source not valid.');
      }
      var destinationNode = nodes.filter(function(node) {return node.connectors.some(function(connector) {return connector.id === edge.destination})})[0];
      if (destinationNode === undefined) {
        throw new ModelvalidationError('Destination not valid.');
      }
      if (sourceNode === destinationNode) {
        throw new ModelvalidationError('Edge with same source and destination nodes.');
      }
      return edge;
    };

    this.validateEdge = function(edge, nodes) {
      this.validateNodes(nodes);
      return this._validateEdge(edge, nodes);
    };

    this.validateConnector = function(connector) {
      if (connector.id === undefined) {
        throw new ModelvalidationError('Id not valid.');
      }
      if (connector.type === undefined || connector.type === null || typeof connector.type !== 'string') {
        throw new ModelvalidationError('Type not valid.');
      }
      return connector;
    };

  }
  Modelvalidation.$inject = ["Topsortservice", "flowchartConstants"];

  angular.module('flowchart')
    .service('Modelvalidation', Modelvalidation);

}());

(function() {

  'use strict';

  function Modelfactory(Modelvalidation) {
    var connectorsHtmlElements = {};
    var canvasHtmlElement = null;

    return function innerModelfactory(model, selectedObjects) {
      Modelvalidation.validateModel(model);
      var modelservice = {
        selectedObjects: selectedObjects
      };

      function selectObject(object) {
        if (modelservice.selectedObjects.indexOf(object) === -1) {
          modelservice.selectedObjects.push(object);
        }
      }

      function deselectObject(object) {
        var index = modelservice.selectedObjects.indexOf(object);
        if (index === -1) {
          throw new Error('Tried to deselect an unselected object');
        }
        modelservice.selectedObjects.splice(index, 1);
      }

      function toggleSelectedObject(object) {
        if (isSelectedObject(object)) {
          deselectObject(object);
        } else {
          selectObject(object);
        }
      }

      function isSelectedObject(object) {
        return modelservice.selectedObjects.indexOf(object) !== -1;
      }

      modelservice.connectors = {

        setHtmlElement: function(connectorId, element) {
          connectorsHtmlElements[connectorId] = element;
        },

        getHtmlElement: function(connectorId) {
          return connectorsHtmlElements[connectorId];
        },

        _getCoords: function(connectorId, centered) {
          var element = this.getHtmlElement(connectorId);
          var canvas = modelservice.getCanvasHtmlElement();
          if (element === null || element === undefined || canvas === null) {
            return {x: 0, y: 0};
          }
          var connectorElementBox = element.getBoundingClientRect();
          var canvasElementBox = canvas.getBoundingClientRect();


          var coords = {
            x: connectorElementBox.left - canvasElementBox.left,
            y: connectorElementBox.top - canvasElementBox.top
          };
          if (centered) {
            coords = {
              x: Math.round(coords.x + element.offsetWidth / 2),
              y: Math.round(coords.y + element.offsetHeight / 2)
            };
          }
          return coords;
        },

        getCoord: function(connectorId) {
          return this._getCoords(connectorId, false);
        },

        getCenteredCoord: function(connectorId) {
          return this._getCoords(connectorId, true);
        }

      };

      modelservice.nodes = {
        getConnectorsByType: function(node, type) {
          return node.connectors.filter(function(connector) {
            return connector.type === type
          });
        },

        select: selectObject,
        deselect: deselectObject,
        toggleSelected: toggleSelectedObject,
        isSelected: isSelectedObject,

        addConnector: function(node, connector) {
          node.connectors.push(connector);
          try {
            Modelvalidation.validateNode(node);
          } catch (error) {
            node.connectors.splice(node.connectors.indexOf(connector), 1);
            throw error;
          }
        },

        delete: function(node) {
          if (this.isSelected(node)) {
            this.deselect(node);
          }
          var index = model.nodes.indexOf(node);
          if (index === -1) {
            if (node === undefined) {
              throw new Error('Passed undefined');
            }
            throw new Error('Tried to delete not existing node')
          }

          var connectorIds = this.getConnectorIds(node);
          for (var i = 0; i < model.edges.length; i++) {
            var edge = model.edges[i];
            if (connectorIds.indexOf(edge.source) !== -1 || connectorIds.indexOf(edge.destination) !== -1) {
              modelservice.edges.delete(edge);
              i--;
            }
          }
          model.nodes.splice(index, 1);
        },

        getSelectedNodes: function() {
          return model.nodes.filter(function(node) {
            return modelservice.nodes.isSelected(node)
          });
        },

        handleClicked: function(node, ctrlKey) {
          if (ctrlKey) {
            modelservice.nodes.toggleSelected(node);
          } else {
            modelservice.deselectAll();
            modelservice.nodes.select(node);
          }
        },

        addNode: function(node) {
          try {
            model.nodes.push(node);
            Modelvalidation.validateNodes(model.nodes);
          } catch(error) {
            model.nodes.splice(model.nodes.indexOf(node), 1);
            throw error;
          }
        },

        getConnectorIds: function(node) {
          return node.connectors.map(function(connector) {
            return connector.id
          });
        }
      };

      modelservice.edges = {

        sourceCoord: function(edge) {
          return modelservice.connectors.getCenteredCoord(edge.source, edge.source);
        },

        destCoord: function(edge) {
          return modelservice.connectors.getCenteredCoord(edge.destination);
        },

        select: selectObject,
        deselect: deselectObject,
        toggleSelected: toggleSelectedObject,
        isSelected: isSelectedObject,

        delete: function
          (edge) {
          var index = model.edges.indexOf(edge);
          if (index === -1) {
            throw new Error('Tried to delete not existing edge')
          }
          if (this.isSelected(edge)) {
            this.deselect(edge)
          }
          model.edges.splice(index, 1);
        },

        getSelectedEdges: function() {
          return model.edges.filter(function(edge) {
            return modelservice.edges.isSelected(edge)
          });
        },

        handleEdgeMouseClick: function(edge, ctrlKey) {
          if (ctrlKey) {
            modelservice.edges.toggleSelected(edge);
          } else {
            modelservice.deselectAll();
            modelservice.edges.select(edge);
          }
        },

        addEdge: function(sourceConnector, destConnector) {
          Modelvalidation.validateConnector(sourceConnector);
          Modelvalidation.validateConnector(destConnector);
          var edge = {source: sourceConnector.id, destination: destConnector.id};
          Modelvalidation.validateEdges(model.edges.concat([edge]), model.nodes);
          model.edges.push(edge);
        }
      };

      modelservice.selectAll = function() {
        angular.forEach(model.nodes, function(value) {
          modelservice.nodes.select(value);
        });
        angular.forEach(model.edges, function(value) {
          modelservice.edges.select(value);
        });
      };

      modelservice.deselectAll = function() {
        modelservice.selectedObjects.splice(0, modelservice.selectedObjects.length);
      };

      modelservice.deleteSelected = function() {
        var edgesToDelete = modelservice.edges.getSelectedEdges();
        angular.forEach(edgesToDelete, function(edge) {
          modelservice.edges.delete(edge);
        });
        var nodesToDelete = modelservice.nodes.getSelectedNodes();
        angular.forEach(nodesToDelete, function(node) {
          modelservice.nodes.delete(node);
        });
      };

      modelservice.setCanvasHtmlElement = function(element) {
        canvasHtmlElement = element;
      };

      modelservice.getCanvasHtmlElement = function() {
        return canvasHtmlElement;
      };

      return modelservice;
    }

  }
  Modelfactory.$inject = ["Modelvalidation"];

  angular.module('flowchart')
    .service('Modelfactory', Modelfactory);

})();

(function() {

  'use strict';

  function fcMagnet(flowchartConstants) {
    return {
      restrict: 'AE',
      link: function(scope, element) {
        element.addClass(flowchartConstants.magnetClass);

        element.on('dragover', scope.callbacks.edgeDragoverMagnet(scope.connector));
        element.on('drop', scope.callbacks.edgeDrop(scope.connector));
        element.on('dragend', scope.callbacks.edgeDragend);
      }
    }
  }
  fcMagnet.$inject = ["flowchartConstants"];

  angular.module('flowchart')
    .directive('fcMagnet', fcMagnet);
}());

(function() {

  'use strict';

  var constants = {
    htmlPrefix: 'fc',
    topConnectorType: 'topConnector',
    bottomConnectorType: 'bottomConnector',
    curvedStyle: 'curved',
    lineStyle: 'line'
  };
  constants.canvasClass = constants.htmlPrefix + '-canvas';
  constants.selectedClass = constants.htmlPrefix + '-selected';
  constants.hoverClass = constants.htmlPrefix + '-hover';
  constants.draggingClass = constants.htmlPrefix + '-dragging';
  constants.edgeClass = constants.htmlPrefix + '-edge';
  constants.connectorClass = constants.htmlPrefix + '-connector';
  constants.magnetClass = constants.htmlPrefix + '-magnet';
  constants.nodeClass = constants.htmlPrefix + '-node';
  constants.topConnectorClass = constants.htmlPrefix + '-' + constants.topConnectorType + 's';
  constants.bottomConnectorClass = constants.htmlPrefix + '-' + constants.bottomConnectorType + 's';

  angular
    .module('flowchart')
    .constant('flowchartConstants', constants);

}());

(function() {

  'use strict';

  function Edgedrawingservice(flowchartConstants) {
    function computeEdgeTangentOffset(pt1, pt2) {
      return (pt2.x - pt1.x) / 2;
    }

    function computeEdgeSourceTangent(pt1, pt2) {
      return {
        x: pt1.x,
        y: pt1.y + computeEdgeTangentOffset(pt1, pt2)
      };
    }

    function computeEdgeDestinationTangent(pt1, pt2) {
      return {
        x: pt2.x,
        y: pt2.y - computeEdgeTangentOffset(pt1, pt2)
      };
    }

    this.getEdgeDAttribute = function(pt1, pt2, style) {
      var dAddribute = 'M ' + pt1.x + ', ' + pt1.y + ' ';
      if (style === flowchartConstants.curvedStyle) {
        var sourceTangent = computeEdgeSourceTangent(pt1, pt2);
        var destinationTangent = computeEdgeDestinationTangent(pt1, pt2);
        dAddribute += 'C ' + sourceTangent.x + ', ' + sourceTangent.y + ' ' + destinationTangent.x + ', ' + destinationTangent.y + ' ' + pt2.x + ', ' + pt2.y;
      } else {
        dAddribute += 'L ' + pt2.x + ', ' + pt2.y;
      }
      return dAddribute;
    };
  }
  Edgedrawingservice.$inject = ["flowchartConstants"];

  angular
    .module('flowchart')
    .service('Edgedrawingservice', Edgedrawingservice);

}());

(function() {

  'use strict';

  function Edgedraggingfactory(Modelvalidation) {
    function factory(modelservice, model, edgeDragging, isValidEdgeCallback, applyFunction) {
      if (isValidEdgeCallback === null) {
        isValidEdgeCallback = function() {
          return true;
        };
      }

      var edgedraggingService = {};

      var draggedEdgeSource = null;
      var dragOffset = {};

      edgeDragging.isDragging = false;
      edgeDragging.dragPoint1 = null;
      edgeDragging.dragPoint2 = null;

      var destinationHtmlElement = null;
      var oldDisplayStyle = "";

      edgedraggingService.dragstart = function(connector) {
        return function(event) {
          edgeDragging.isDragging = true;
          draggedEdgeSource = connector;
          edgeDragging.dragPoint1 = modelservice.connectors.getCenteredCoord(connector.id);

          var canvas = modelservice.getCanvasHtmlElement();
          if (!canvas) {
            throw new Error('No canvas while edgedraggingService found.');
          }
          dragOffset.x = -canvas.getBoundingClientRect().left;
          dragOffset.y = -canvas.getBoundingClientRect().top;

          edgeDragging.dragPoint2 = {
            x: event.clientX + dragOffset.x,
            y: event.clientY + dragOffset.y
          };

          event.dataTransfer.setData('Text', 'Just to support firefox');
          if (event.dataTransfer.setDragImage) {
            var invisibleDiv = angular.element('<div></div>')[0]; // This divs stays invisible, because it is not in the dom.
            event.dataTransfer.setDragImage(invisibleDiv, 0, 0);
          } else {
            destinationHtmlElement = event.target;
            oldDisplayStyle = destinationHtmlElement.style.display;
            event.target.style.display = 'none'; // Internetexplorer does not support setDragImage, but it takes an screenshot, from the draggedelement and uses it as dragimage.
            // Since angular redraws the element in the next dragover call, display: none never gets visible to the user.
          }
          event.stopPropagation();
        };
      };

      edgedraggingService.dragover = function(event) {
        if (edgeDragging.isDragging) {
          return applyFunction(function() {
            if (destinationHtmlElement !== null) {
              destinationHtmlElement.style.display = oldDisplayStyle;
            }

            edgeDragging.dragPoint2 = {
              x: event.clientX + dragOffset.x,
              y: event.clientY + dragOffset.y
            };

          });
        }
      };

      edgedraggingService.dragoverConnector = function(connector) {
        return function(event) {
          if (edgeDragging.isDragging) {
            edgedraggingService.dragover(event);
            try {
              Modelvalidation.validateEdges(model.edges.concat([{
                source: draggedEdgeSource.id,
                destination: connector.id
              }]), model.nodes);
            } catch (error) {
              if (error instanceof Modelvalidation.ModelvalidationError) {
                return true;
              } else {
                throw error;
              }
            }
            if (isValidEdgeCallback(draggedEdgeSource, connector)) {
              event.preventDefault();
              event.stopPropagation();
              return false;
            }
          }
        };
      };

      edgedraggingService.dragoverMagnet = function(connector) {
        return function(event) {
          if (edgeDragging.isDragging) {
            edgedraggingService.dragover(event);
              try {
              Modelvalidation.validateEdges(model.edges.concat([{
                source: draggedEdgeSource.id,
                destination: connector.id
              }]), model.nodes);
            } catch (error) {
              if (error instanceof Modelvalidation.ModelvalidationError) {
                return true;
              } else {
                throw error;
              }
            }
            if (isValidEdgeCallback(draggedEdgeSource, connector)) {
              return applyFunction(function() {
                edgeDragging.dragPoint2 = modelservice.connectors.getCenteredCoord(connector.id);
                event.preventDefault();
                event.stopPropagation();
                return false;
              });
            }
          }

        }
      };

      edgedraggingService.dragend = function(event) {
        if (edgeDragging.isDragging) {
          edgeDragging.isDragging = false;
          edgeDragging.dragPoint1 = null;
          edgeDragging.dragPoint2 = null;
          event.stopPropagation();
        }
      };

      edgedraggingService.drop = function(targetConnector) {
        return function(event) {
          if (edgeDragging.isDragging) {
            try {
              Modelvalidation.validateEdges(model.edges.concat([{
                source: draggedEdgeSource.id,
                destination: targetConnector.id
              }]), model.nodes);
            } catch (error) {
              if (error instanceof Modelvalidation.ModelvalidationError) {
                return true;
              } else {
                throw error;
              }
            }
            if (isValidEdgeCallback(draggedEdgeSource, targetConnector)) {
              modelservice.edges.addEdge(draggedEdgeSource, targetConnector);
              event.stopPropagation();
              event.preventDefault();
              return false;
            }
          }
        }
      };
      return edgedraggingService;
    }

    return factory;
  }
  Edgedraggingfactory.$inject = ["Modelvalidation"];

  angular.module('flowchart')
    .factory('Edgedraggingfactory', Edgedraggingfactory);

}());

(function() {

  'use strict';

  function fcConnector(flowchartConstants) {
    return {
      restrict: 'A',
      link: function(scope, element) {
        element.attr('draggable', 'true');

        element.on('dragover', scope.callbacks.edgeDragoverConnector);
        element.on('drop', scope.callbacks.edgeDrop(scope.connector));
        element.on('dragend', scope.callbacks.edgeDragend);
        element.on('dragstart', scope.callbacks.edgeDragstart(scope.connector));
        element.on('mouseenter', scope.callbacks.connectorMouseEnter(scope.connector));
        element.on('mouseleave', scope.callbacks.connectorMouseLeave(scope.connector));

        element.addClass(flowchartConstants.connectorClass);
        scope.$watch('mouseOverConnector', function(value) {
          if (value === scope.connector) {
            element.addClass(flowchartConstants.hoverClass);
          } else {
            element.removeClass(flowchartConstants.hoverClass);
          }
        });

        scope.modelservice.connectors.setHtmlElement(scope.connector.id, element[0]);
      }
    };
  }
  fcConnector.$inject = ["flowchartConstants"];

  angular
    .module('flowchart')
    .directive('fcConnector', fcConnector);

}());

(function() {

  'use strict';

  function fcCanvas(flowchartConstants) {
    return {
      restrict: 'E',
      templateUrl: "flowchart/canvas.html",
      replace: true,
      scope: {
        model: "=",
        selectedObjects: "=",
        edgeStyle: '@',
        userCallbacks: '=?callbacks'
      },
      controller: 'canvasController',
      link: function(scope, element) {
        if (scope.edgeStyle !== flowchartConstants.curvedStyle && scope.edgeStyle !== flowchartConstants.lineStyle) {
          throw new Error('edgeStyle not supported.');
        }

        scope.flowchartConstants = flowchartConstants;
        element.addClass(flowchartConstants.canvasClass);
        element.on('dragover', scope.dragover);
        element.on('drop', scope.drop);

        scope.modelservice.setCanvasHtmlElement(element[0]);
      }
    }
  }
  fcCanvas.$inject = ["flowchartConstants"];

  angular
    .module('flowchart')
    .directive('fcCanvas', fcCanvas);

}());


(function() {

  'use strict';

  function canvasController($scope, Mouseoverfactory, Nodedraggingfactory, Modelfactory, Edgedraggingfactory, Edgedrawingservice) {

    $scope.userCallbacks = $scope.userCallbacks || {};
    angular.forEach($scope.userCallbacks, function(callback) {
      if (!angular.isFunction(callback)) {
        throw new Error('All callbacks should be functions.');
      }
    });

    $scope.modelservice = Modelfactory($scope.model, $scope.selectedObjects);

    $scope.nodeDragging = {};
    var nodedraggingservice = Nodedraggingfactory($scope.modelservice, $scope.nodeDragging, $scope.$apply.bind($scope));

    $scope.edgeDragging = {};
    var edgedraggingservice = Edgedraggingfactory($scope.modelservice, $scope.model, $scope.edgeDragging, $scope.userCallbacks.isValidEdge || null, $scope.$apply.bind($scope));

    $scope.mouseOver = {};
    var mouseoverservice = Mouseoverfactory($scope.mouseOver, $scope.$apply.bind($scope));

    $scope.edgeMouseEnter = mouseoverservice.edgeMouseEnter;
    $scope.edgeMouseLeave = mouseoverservice.edgeMouseLeave;

    $scope.canvasClick = $scope.modelservice.deselectAll;

    $scope.drop = nodedraggingservice.drop;
    $scope.dragover = function(event) {
      nodedraggingservice.dragover(event);
      edgedraggingservice.dragover(event);
    };

    $scope.edgeClick = function(event, edge) {
      $scope.modelservice.edges.handleEdgeMouseClick(edge, event.ctrlKey);
      // Don't let the chart handle the mouse down.
      event.stopPropagation();
      event.preventDefault();
    };

    $scope.edgeDoubleClick = $scope.userCallbacks.edgeDoubleClick || angular.noop;
    $scope.edgeMouseOver = $scope.userCallbacks.edgeMouseOver || angular.noop;

    $scope.callbacks = {
      nodeDragstart: nodedraggingservice.dragstart,
      nodeDragend: nodedraggingservice.dragend,
      edgeDragstart: edgedraggingservice.dragstart,
      edgeDragend: edgedraggingservice.dragend,
      edgeDrop: edgedraggingservice.drop,
      edgeDragoverConnector: edgedraggingservice.dragoverConnector,
      edgeDragoverMagnet: edgedraggingservice.dragoverMagnet,
      nodeMouseEnter: mouseoverservice.nodeMouseEnter,
      nodeMouseLeave: mouseoverservice.nodeMouseLeave,
      connectorMouseEnter: mouseoverservice.connectorMouseEnter,
      connectorMouseLeave: mouseoverservice.connectorMouseLeave,
      nodeClicked: function(node) {
        return function(event) {
          $scope.modelservice.nodes.handleClicked(node, event.ctrlKey);
          $scope.$apply();

          // Don't let the chart handle the mouse down.
          event.stopPropagation();
          event.preventDefault();
        }
      }
    };

    $scope.getEdgeDAttribute = Edgedrawingservice.getEdgeDAttribute;
  }
  canvasController.$inject = ["$scope", "Mouseoverfactory", "Nodedraggingfactory", "Modelfactory", "Edgedraggingfactory", "Edgedrawingservice"];

  angular
    .module('flowchart')
    .controller('canvasController', canvasController);

}());



(function(module) {
try {
  module = angular.module('flowchart-templates');
} catch (e) {
  module = angular.module('flowchart-templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('flowchart/canvas.html',
    '<div ng-click="canvasClick($event)">\n' +
    '  <svg>\n' +
    '    <g ng-repeat="edge in model.edges">\n' +
    '      <path\n' +
    '        ng-click="edgeClick($event, edge)"\n' +
    '        ng-dblclick="edgeDoubleClick($event, edge)"\n' +
    '        ng-mouseover="edgeMouseOver($event, edge)"\n' +
    '        ng-mouseenter="edgeMouseEnter($event, edge)"\n' +
    '        ng-mouseleave="edgeMouseLeave($event, edge)"\n' +
    '        ng-attr-class="{{(modelservice.edges.isSelected(edge) && flowchartConstants.selectedClass + \' \' + flowchartConstants.edgeClass) || edge == mouseOver.edge && flowchartConstants.hoverClass + \' \' + flowchartConstants.edgeClass || flowchartConstants.edgeClass}}"\n' +
    '        ng-attr-d="{{getEdgeDAttribute(modelservice.edges.sourceCoord(edge), modelservice.edges.destCoord(edge), edgeStyle)}}"></path>\n' +
    '    </g>\n' +
    '    <g ng-if="edgeDragging.isDragging">\n' +
    '      <path class="{{ flowchartConstants.edgeClass }} {{ flowchartConstants.draggingClass }}"\n' +
    '            ng-attr-d="{{getEdgeDAttribute(edgeDragging.dragPoint1, edgeDragging.dragPoint2, edgeStyle)}}"></path>\n' +
    '      <circle class="edge-endpoint" r="4" ng-attr-cx="{{edgeDragging.dragPoint2.x}}"\n' +
    '              ng-attr-cy="{{edgeDragging.dragPoint2.y}}"></circle>\n' +
    '    </g>\n' +
    '  </svg>\n' +
    '  <div class="fc-innercanvas">\n' +
    '    <fc-node selected="modelservice.nodes.isSelected(node)" under-mouse="node === mouseOver.node" node="node"\n' +
    '             mouse-over-connector="mouseOver.connector"\n' +
    '             modelservice="modelservice"\n' +
    '             dragged-node="nodeDragging.draggedNode"\n' +
    '             callbacks="callbacks"\n' +
    '             ng-repeat="node in model.nodes"></fc-node>\n' +
    '  </div>\n' +
    '</div>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('flowchart-templates');
} catch (e) {
  module = angular.module('flowchart-templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('flowchart/node.html',
    '<div\n' +
    '  id="{{node.id}}"\n' +
    '  ng-attr-style="position: absolute; top: {{ node.y }}px; left: {{ node.x }}px;">\n' +
    '  <div class="innerNode">\n' +
    '    <p>{{ node.name }}</p>\n' +
    '\n' +
    '    <div class="{{flowchartConstants.topConnectorClass}}">\n' +
    '      <div fc-magnet\n' +
    '           ng-repeat="connector in modelservice.nodes.getConnectorsByType(node, flowchartConstants.topConnectorType)">\n' +
    '        <div fc-connector></div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '    <div class="{{flowchartConstants.bottomConnectorClass}}">\n' +
    '      <div fc-magnet\n' +
    '           ng-repeat="connector in modelservice.nodes.getConnectorsByType(node, flowchartConstants.bottomConnectorType)">\n' +
    '        <div fc-connector></div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div class="fc-nodedelete" ng-click="modelservice.nodes.delete(node)">\n' +
    '    X\n' +
    '  </div>\n' +
    '</div>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('flowchart-templates');
} catch (e) {
  module = angular.module('flowchart-templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('flowchart/onedatanode.html',
    '<div\n' +
    '  id="{{node.id}}"\n' +
    '  ng-attr-style="position: absolute; top: {{ node.y }}px; left: {{ node.x }}px; background: {{ node.color }}; border-color: {{node.borderColor}}">\n' +
    '  <p>{{ node.name }}</p>\n' +
    '\n' +
    '  <div class="{{flowchartConstants.topConnectorClass}}">\n' +
    '    <div fc-connector\n' +
    '         ng-repeat="connector in modelservice.nodes.getConnectorsByType(node, flowchartConstants.topConnectorType)"></div>\n' +
    '  </div>\n' +
    '  <div class="{{flowchartConstants.bottomConnectorClass}}">\n' +
    '    <div fc-connector\n' +
    '         ng-repeat="connector in modelservice.nodes.getConnectorsByType(node, flowchartConstants.bottomConnectorType)"></div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '');
}]);
})();