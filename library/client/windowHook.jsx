import { useState, useCallback } from 'react';
import _ from 'lodash';

export const useWindowObjectSignal = (path, initialValue) => {
    const [value, setValue] = useState(() => {
        const existingValue = _.get(window, path);
        if (existingValue === undefined) {
          _.set(window, path, initialValue);
          console.log(window.app)
          return initialValue;
        }
        return existingValue;
      });
    
      const updateValue = useCallback((valueOrUpdater) => {
        // Determine if valueOrUpdater is a function and call it with the current value, otherwise use valueOrUpdater directly
        const currentValue = _.get(window, path);
        const newValue = typeof valueOrUpdater === 'function' ? valueOrUpdater(currentValue) : valueOrUpdater;
        
        // Ensure updates are immutable, especially for arrays and objects
        _.set(window, path, _.cloneDeep(newValue));
        setValue(newValue);
      }, [path]);
    
      const getValue = useCallback(() => _.get(window, path, initialValue), [path, value]);
    
      return [getValue, updateValue];
}
