he attached project has all the use case data in the html file.. that makes is very difficult to be maintained.

I want something where I can load use cases from directories.. different products might use different folders.

all the use cases shall be defined in markuplangue which is nice to read even as text but looks even better in the browser..

the rest of the logic should stay as it is, however there needs to be an option to define an S3 bucket or github page where the use cases shall be loaded from. 

the /config file should have an option to trigger to download the latest files in case a use case was created before deployment.

on start it should still load a list of use cases...
any idea how we can avoid conflicts between same file names in different folders?

shall we add something like mim:welcome or somthing in case a use case could be in multiple directories... I want to give the users the option to use filenames that allow to relate to the use cases

could you show such conflicts on the /config page?

also add an option to define a POC start and end Date for the POC will be provided as environment variables.. but it should be possible to change them on the config page as well as the.

it should also be possible to change the SAName, the PROSPECT and a new variable called: Partner

the product and category order should be used be order the use cases in the poc..
the config page should be able to move them in order, at best also via drag and drop. for categories and use cases

the config file may group the use cases by product categories..

and remove the json output from he /config file. we will just output the string that a user could use to configure the use cases he want's to see and use this to spin up a new one. 

each use case should have 2 files, 1 for the usecase as such as the markaup.MD file and a config file that contains metadata for each use case...

it needs to contain the use case name, a version of this, 
a short description what this use case does
a option for customer related preparation work maybe "CUSTOMER_PREPARATION_TASK' or better if you know.
a time in h how long it typically takes to prepare their environment
 use "ESTIMATED_HOURS
a product
a productcategory
a category 
a category_order
a use_case_order

it will also contain the credentials that are currently all in a single file (or would you suggest a separate file for credentials? (there are not security matters as the config files will only contain placeholders... 

oh good point the logic of replacing the @@variables@@ should apply to the markup as well as config files...

if you find other issues please feel free to fix them as well, if you need additional files, please let me know...

I don't need the sendWebhook any longer... we still might some optiont to write to the disk..

please also convert the existing use case from the html to the markup files and create the config files...

we will need to make a daily API call that sends the activated use cases, the prosect name,the poc start and end data and probably additioal info and the metadata of all use cases somewhere else.. no need to do this now, but so you have an idea that we'll need to be able to use the data for this call 

let me know if you have any clarifying questions or if you need any additional information.





only one folder for each product category... no subfolders..



/use-cases/machine-identity/





### 4. S3/GitHub Loading Should this be: - **Runtime fetch**: JavaScript fetches from S3/GitHub when user loads page - **Build-time download**: A script downloads files to local storage before serving - **Both**: Config option to choose either approach



great question: load them at startup, but allow via the config page to catch new use cases...

also show if there are new once and if they should be downloaded..



the app should be build in a way that when the browser is refreshed and a new use case is in the file system it should 





### 5. Backend Technology The current solution uses PHP. Do you want to: - Keep PHP for the backend - Move to a static site with client-side JavaScript only - Use Node.js or another backend



you can decide what is best. it will be running in a container, if that makes any difference...



variables will be passed at runtime

For the environment variables (POC_START_DATE, POC_END_DATE, PROSPECT, Partner, SaaSName), should these be: - Set in a single .env file - Passed as actual environment variables at runtime - Stored in a JSON/YAML config file



there will be an additioal variable 



POC_OR_DEMO this will determine if we send this heardbeat API was talking about earlier...



it will also need a 



POC_INSIGHTS_URL



this is where it will report to



and a USE_CASE_REPO_URL where it will actually grab the use cases from... at startup





8. Feedback System

Should the star-rating feedback system be:





Kept as-is (needs backend to save)



Converted to email/form submission



Removed entirely



great question.



saving the completeness shall still be safed to disk so, someone else will also see the progress..



we will also make an API call to an external API when ever a use case is completed

,rated or feedback is sent..



oh and please switch from basic to a form based auth... will some companies block basic auth... 

so... let's use forms... it should have some background image... we can define, use a dummy for now.





9. Ordering

For the drag-and-drop ordering on the config page - should this persist to:





A local config file (requires write access)



LocalStorage in browser (per-user, per-browser only)



Generate a new config string that can be used to spin up a new instance



needs to write to disk.





10. Existing PHP Dependencies

I see saveCompletedUseCases.php, sendWebhook.php, saveActiveUsecases.php. Besides removing sendWebhook.php, should I:





Keep the other PHP files



Convert to a different approach (e.g., localStorage for completion tracking)



if you deside earlier for a different backend technology as it fit's better  our project feel free to use it. We will need to be able to save to disk the saveactive use cases is for the config tool so it cn change what should be displayed,, please write this to disk..



also write all other configurations to a disk... if they exists at container startup, what's in the local storage should have priority over the environment variables.. overwise create them at startup.



(this is so the containers could get a persistent volume claim and the data would survive a potential restart of the container










# Issues

 download does show a number of all files it downloaded not the number of use cases.

 when downloading after clicking on scan the bar is at the bottom of the list of downloads, sbould be abve otherswisse it's no seen.

 the secets is not visible, even the files have been downloaded...