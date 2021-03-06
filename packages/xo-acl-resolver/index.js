'use strict'

// These global variables are not a problem because the algorithm is
// synchronous.
let permissionsByObject
let getObject

// -------------------------------------------------------------------

const authorized = () => true // eslint-disable-line no-unused-vars
const forbiddden = () => false // eslint-disable-line no-unused-vars

// eslint-disable-next-line no-unused-vars
const and = (...checkers) => (object, permission) => {
  for (const checker of checkers) {
    if (!checker(object, permission)) {
      return false
    }
  }
  return true
}

// eslint-disable-next-line no-unused-vars
const or = (...checkers) => (object, permission) => {
  for (const checker of checkers) {
    if (checker(object, permission)) {
      return true
    }
  }
  return false
}

// -------------------------------------------------------------------

const checkMember = memberName => (object, permission) => {
  const member = object[memberName]
  return member !== object.id && checkAuthorization(member, permission)
}

const checkSelf = ({ id }, permission) => {
  const permissionsForObject = permissionsByObject[id]

  return permissionsForObject && permissionsForObject[permission]
}

// ===================================================================

const checkAuthorizationByTypes = {
  host: or(checkSelf, checkMember('$pool')),

  message: checkMember('$object'),

  network: or(checkSelf, checkMember('$pool')),

  PIF: checkMember('$host'),

  SR: or(checkSelf, checkMember('$container')),

  task: checkMember('$host'),

  VBD: checkMember('VDI'),

  // Access to a VDI is granted if the user has access to the
  // containing SR or to a linked VM.
  VDI (vdi, permission) {
    // Check authorization for the containing SR.
    if (checkAuthorization(vdi.$SR, permission)) {
      return true
    }

    // Check authorization for each of the connected VMs.
    for (const vbdId of vdi.$VBDs) {
      if (checkAuthorization(getObject(vbdId).VM, permission)) {
        return true
      }
    }

    return false
  },

  'VDI-snapshot': checkMember('$snapshot_of'),

  VIF: or(checkMember('$network'), checkMember('$VM')),

  VM: or(checkSelf, checkMember('$container')),

  'VM-controller': checkMember('$container'),

  'VM-snapshot': or(checkSelf, checkMember('$snapshot_of')),

  'VM-template': or(checkSelf, checkMember('$pool')),
}

// Hoisting is important for this function.
function checkAuthorization (objectId, permission) {
  const object = getObject(objectId)
  if (!object) {
    return false
  }

  const checker = checkAuthorizationByTypes[object.type] || checkSelf

  return checker(object, permission)
}

// -------------------------------------------------------------------

module.exports = (
  permissionsByObject_,
  getObject_,
  permissions,
  permission
) => {
  // Assign global variables.
  permissionsByObject = permissionsByObject_
  getObject = getObject_

  try {
    if (permission) {
      return checkAuthorization(permissions, permission)
    } else {
      for (const [objectId, permission] of permissions) {
        if (!checkAuthorization(objectId, permission)) {
          return false
        }
      }
    }

    return true
  } finally {
    // Free the global variables.
    permissionsByObject = getObject = null
  }
}
