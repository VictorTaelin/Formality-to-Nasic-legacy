const {erase, Var, App, Lam} = require("formality-lang");
const {Net, Pointer, Node} = require("nasic");

const compile = (term, defs = {}) => {
  const build_net = (term, net, ref_ptrs, var_ptrs, level) => {
    const get_var = (ptr) => {
      if (!net.enter_port(ptr) || net.enter_port(ptr).equal(ptr)) {
        return ptr;
      } else {
        var dups_ptr = net.enter_port(ptr);
        var dup_addr = net.alloc_node(Math.floor((1 + Math.random()) * Math.pow(2,16)));
        net.link_ports(new Pointer(dup_addr, 0), ptr);
        net.link_ports(new Pointer(dup_addr, 1), dups_ptr);
        return new Pointer(dup_addr, 2);
      }
    };
    switch (term[0]) {
      case "Lam":
        var lam_addr = net.alloc_node(1);
        net.link_ports(new Pointer(lam_addr, 1), new Pointer(lam_addr, 1));
        var_ptrs.push(new Pointer(lam_addr, 1));
        var body_ptr = build_net(term[1].body, net, ref_ptrs, var_ptrs, level);
        var_ptrs.pop();
        net.link_ports(new Pointer(lam_addr, 2), body_ptr);
        return new Pointer(lam_addr, 0);
      case "App":
        var app_addr = net.alloc_node(1);
        var func_ptr = build_net(term[1].func, net, ref_ptrs, var_ptrs, level);
        net.link_ports(new Pointer(app_addr, 0), func_ptr);
        var argm_ptr = build_net(term[1].argm, net, ref_ptrs, var_ptrs, level);
        net.link_ports(new Pointer(app_addr, 1), argm_ptr)
        return new Pointer(app_addr, 2);
      case "Var":
        return get_var(var_ptrs[var_ptrs.length - term[1].index - 1]);
      case "Ref":
        var name = term[1].name;
        //return build_net(erase(defs[name].term), net, ref_ptrs, var_ptrs, level);
        if (!ref_ptrs[name]) {
          var dup_addr = net.alloc_node(Math.floor((1 + Math.random()) * Math.pow(2,16)));
          net.link_ports(new Pointer(dup_addr, 1), new Pointer(dup_addr, 1));
          net.link_ports(new Pointer(dup_addr, 2), new Pointer(dup_addr, 2));
          var ref_ptrs = Object.assign({[name]: new Pointer(dup_addr, 1)});
          var term_ptr = build_net(erase(defs[name].term), net, ref_ptrs, var_ptrs, level);
          net.link_ports(new Pointer(dup_addr, 0), term_ptr);
          return new Pointer(dup_addr, 2);
        } else {
          return get_var(ref_ptrs[name]);
        }
      default:
        return build_net(Lam("", null, Var(0)), net, ref_ptrs, var_ptrs, level);
    }
  };
  var level_of = {};
  var net = new Net();
  var root_addr = net.alloc_node(0);
  var term_ptr = build_net(erase(term), net, {}, [], 0);
  net.link_ports(new Pointer(root_addr, 0), new Pointer(root_addr, 2));
  net.link_ports(new Pointer(root_addr, 1), term_ptr);
  return net;
}

const decompile = (net) => {
  const build_term = (net, ptr, var_ptrs, dup_exit) => {
    var label = net.nodes[ptr.addr].label;
    if (label === 1) {
      switch (ptr.port) {
        case 0:
          var_ptrs.push(new Pointer(ptr.addr, 1));
          var body = build_term(net, net.enter_port(new Pointer(ptr.addr, 2)), var_ptrs, dup_exit);
          var_ptrs.pop();
          return Lam("x" + var_ptrs.length, null, body);
        case 1:
          for (var index = 0; index < var_ptrs.length; ++index) {
            if (var_ptrs[var_ptrs.length - index - 1].equal(ptr)) {
              return Var(index);
            }
          }
        case 2:
          var argm = build_term(net, net.enter_port(new Pointer(ptr.addr, 1)), var_ptrs, dup_exit);
          var func = build_term(net, net.enter_port(new Pointer(ptr.addr, 0)), var_ptrs, dup_exit);
          return App(func, argm);
      }
    } else {
      switch (ptr.port) {
        case 0:
          var exit = dup_exit.pop();
          var term = build_term(net, net.enter_port(new Pointer(ptr.addr, exit)), var_ptrs, dup_exit);
          dup_exit.push(exit);
          return term;
        default:
          dup_exit.push(ptr.port);
          var term = build_term(net, net.enter_port(new Pointer(ptr.addr, 0)), var_ptrs, dup_exit);
          dup_exit.pop();
          return term;
      }
    }
  };
  return build_term(net, net.enter_port(new Pointer(0, 1)), [], []);
}

const norm_with_stats = (term, defs = {}, lazy = true) => {
  var net = compile(term, defs);
  var stats = lazy ? net.reduce_lazy() : net.reduce();
  var norm = decompile(net);
  return {norm, stats};
};

const norm = (term, defs, lazy) => {
  return norm_with_stats(term, defs, lazy).norm;
};

module.exports = {compile, decompile, norm_with_stats, norm};
