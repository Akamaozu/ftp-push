// ITERATOR
module.exports = function(container, processor){

	if(!container || !processor) return;
	if(typeof processor !== 'function'){ throw new Error('PROCESSOR GIVEN IS NOT A FUNCTION'); }
	
	var container_type, do_next;	
		container_type = Object.prototype.toString.call( container );

	switch( container_type ){

		case '[object Array]': 

			array_each(container, processor);

		break;

		case '[object Object]':
		default:

			object_each(container, processor);

		break;
	}

	function array_each(array, processor){
	
		for (var i = 0; i < array.length; i++) {
			
			do_next = processor(array[i], i);

			if(do_next === false) break;
		}
	}

	function object_each( object, processor){

        for(var prop in object){

          if( !object.hasOwnProperty(prop) ) continue;

          do_next = processor( object[prop], prop );

          if(do_next === false) break;
        }
	}
}