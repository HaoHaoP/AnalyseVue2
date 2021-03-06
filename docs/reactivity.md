# 响应式原理

响应式是Vue最重要的特性，通过响应式在修改数据的时候更新视图来实现MVVM模式。在[Vue2文档](https://cn.vuejs.org/v2/guide/reactivity.html#如何追踪变化)里指出，Vue是使用[Object.defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)将``data``选项里的``property``全部转为[getter/setter](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Working_with_Objects#定义_getters_与_setters)来实现响应式。查阅[MDN文档](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty#浏览器兼容性)也可以得知[Object.defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)是不支持IE8以及更低版本的浏览器，因此Vue也不支持。

## 关于MVVM

### 什么是MVVM？

在使用Vue开发的过程中，最直观的感受就是修改``data``中的数据能实时更新到视图上。MVVM是Model-View-ViewModel的简写。ViewModel是连接View（视图）和Model（数据）的中间件，其实我认为觉得Model-ViewModel-View更合适。
以我个人的理解ViewModel实际上是给View和Model创建了一种双向数据绑定关系，既：

- ViewModel能够观察到Model的变化，并对视图对应的内容进行更新。
- ViewModel能够监听到View的变化，并能够通知数据发生变化。

### Vue是如何实现MVVM的？

实现MVVM通常有几种方式：发布订阅/观察者模式、脏值检查、数据劫持，以上几种方式都可以通过Google查阅资料去学习。这里我们主要学习的是Vue如何通过结合数据劫持和发布订阅模式来实现MVVM。Vue这部分特性是在[vue/src/core/observer/](https://github.com/vuejs/vue/tree/2.6/src/core/observer)中实现的，为了便于理解我们先不考虑对象、数组等情况，实现一个简单的MVVM数据绑定。

``` html
<html>

<body>
  <div id="app">
    <div>{{name}}</div>
  </div>
</body>

</html>
<script>
  /**
   * 劫持监听属性
   */
  function observe(data) {
    Object.keys(data).forEach(key => {
      let val = data[key]
      if (typeof val === 'object') {
        observe(val)
      }
      let dep = new Dep()
      // 对象属性订阅
      Object.defineProperty(data, key, {
        // 对象属性拦截
        get() {
          if (Dep.target) {
            // 添加订阅者
            dep.addSub(Dep.target)
          }
          return val
        },
        // 对象属性设置
        set(newVal) {
          if (newVal !== val) {
            val = newVal
            // 更新视图
            dep.notify()
          }
        }
      })
    })
  }

  /**
   * 观察者集合
   */
  class Dep {
    constructor() {
      this.subs = []
    }

    /**
     * 添加观察者
     * @param {Object} sub 观察者
     */
    addSub(sub) {
      this.subs.push(sub)
    }

    /**
     * 通知观察者
     */
    notify() {
      this.subs.forEach(sub => sub.update())
    }
  }

  /**
   * 观察者
   */
  class Watcher {

    /**
     * 构造函数
     * @param {Object} vm Vue实例
     * @param {String} exp 表达式
     * @param {Function} cb 回调函数
     */
    constructor(vm, exp, cb) {
      this.vm = vm
      this.exp = exp
      this.cb = cb
      this.value = this.get()
    }

    /**
     * 获取值
     * @return {Object} 值
     */
    get() {
      Dep.target = this
      let value = this.vm.data[this.exp]
      Dep.target = null
      return value
    }

    /**
     * 更新值
     */
    update() {
      let newVal = this.get()
      let oldVal = this.value
      if (newVal !== oldVal) {
        this.cb(newVal)
      }
    }
  }

  /**
   * 解析元素节点
   */
  function compile(el, vm) {
    let nodeList = el.childNodes
    // 遍历节点
    Array.from(nodeList).forEach(node => {
      let text = node.textContent
      if (/\{\{(.*)\}\}/.test(text)) {
        // 替换文本节点
        let [, exp] = text.match(/\{\{(.*)\}\}/)
        let val = vm.data[exp]
        node.textContent = val
        // 添加观察者
        new Watcher(vm, exp, function (newVal) {
          node.textContent = newVal
        })
      }
      // 递归子节点
      if (node.childNodes && node.childNodes.length) {
        compile(node, vm)
      }
    })
  }

  class Vue {
    constructor(options) {
      this.$el = document.getElementById(options.el)
      this.data = options.data
      observe(this.data)
      compile(this.$el, this)
      options.created()
    }
  }

  const vm = new Vue({
    el: 'app',
    data: {
      name: 'hello',
    },
    created() {
      setTimeout(() => {
        this.data.name = 'world'
      }, 1000)
    }
  })
</script>
```
### 工作流程

- Vue 构造函数，集中以下模块实现MVVM
- observe 通过Object.definePropty进行数据劫持
- Watcher 观察者，对数据进行观察以及保存数据修改需要触发的回调
- Dep 发布订阅者，添加观察者以及在数据发生改变的时候通知观察者
- compile 解析元素节点，将数据显示到HTML模版

![工作流程](../imgs/reactivity.jpg)

## Object.defineProperty的缺陷

学习过Vue3的小伙伴已经知道，Vue3用[Proxy](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy)来代替了[Object.defineProperty](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty)来实现数据响应，是因为``defineProperty``有一定的缺陷。那么使用``defineProperty``有什么缺陷呢？

- 无法检测到对象属性的新增或删除
- 无法监听数组变化

在官方文档[检测变化的注意事项](https://cn.vuejs.org/v2/guide/reactivity.html#检测变化的注意事项)中提到，对于数组的数组项目修改和对象的属性变更要使用``Vue.set``来触发响应式系统的状态更新。否则修改数组的数组项目和对象的属性是不会触发更新。有时候遇到层级过多的对象可能还需要通过使用``$forceUpdate``来强制重新渲染。为什么会有这样的缺陷？

1. ``defineProperty``只能劫持对象的属性，从而需要对每个对象，每个属性进行遍历。如果对象的属性是对象，还需要深度遍历。
2. ``defineProperty``是可以监控到数组下标的变化的，但是尤雨溪出于对性能和用户体验的考虑，弃用了这种特性。具体可以参考[《记一次思否问答的问题思考：Vue为什么不能检测数组变动》](https://segmentfault.com/a/1190000015783546)。

关于第二点其实是有很大争议的。我个人的看法是Vue2是在性能和体验上找到了一种巧妙的平衡。学过原型链的小伙伴都知道``Array``的原型链是指向``Object``的，实际上数组也是一种对象。在开发体验上为了保持数组和对象操作一致，都可以使用``Vue.set``来修改属性或数组项目变更。另外也避免了``shift`` ``unshift`` ``splice`` ``sort`` ``reverse``这些数组非尾部操作带来的性能问题。这些非尾部移动可以写一个简单的代码来实验，这会触发数组索引的移动或变动，触发很多次的get和set。

```javascript
function observe(data) {
  Object.keys(data).forEach(key => {
    let val = data[key]
    if (typeof val === 'object') {
      observe(val)
    }
    Object.defineProperty(data, key, {
      get() {
        console.log('get')
        return val
      },
      set(newVal) {
        if (newVal !== val) {
          val = newVal
          console.log('set')
        }
      }
    })
  })
}

let arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]

observe(arr)

arr.splice(0, 1)
```