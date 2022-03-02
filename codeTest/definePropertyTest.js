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